import type { Plugin } from '@elizaos/core';
import {
  type Action,
  type ActionResult,
  type Evaluator,
  type HandlerCallback,
  type HandlerOptions,
  type IAgentRuntime,
  type Memory,
  type Provider,
  type ProviderResult,
  Service,
  type State,
  logger,
} from '@elizaos/core';

import type {
  TradingSignal,
  TradeRecord,
  StrategyConfig,
  SignalsApiResponse,
} from './types.ts';
import { DEFAULT_STRATEGY_CONFIG } from './types.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_API_URL = 'https://trading-caller-production.up.railway.app';
const SEEN_SIGNALS_MAX = 500;
const MIN_TRADES_FOR_REVIEW = 3;
const RECENT_TRADES_WINDOW = 5;
const PERFORMANCE_SHIFT_THRESHOLD = 20;

/** Simulated portfolio value for paper trading (USD) */
const PAPER_PORTFOLIO_VALUE_USD = 1000;

// ---------------------------------------------------------------------------
// In-memory store
//
// ElizaOS v1.7.2 does not expose cacheManager on IAgentRuntime.  We use a
// module-scoped Map instead.  This is fine for a single-process agent — data
// persists for the lifetime of the process and is fast to access.
// ---------------------------------------------------------------------------

const store = new Map<string, unknown>();

function storeGet<T>(key: string): T | null {
  const value = store.get(key);
  if (value === undefined) return null;
  return value as T;
}

function storeSet<T>(key: string, value: T): void {
  store.set(key, value);
}

// Store keys (named constants to avoid magic strings)
const KEY_SEEN_SIGNAL_IDS = 'seen-signal-ids';
const KEY_PENDING_SIGNALS = 'pending-signals';
const KEY_OPEN_TRADES = 'open-trades';
const KEY_TRADE_JOURNAL = 'trade-journal';
const KEY_STRATEGY_CONFIG = 'strategy-config';
const KEY_COOL_OFF_UNTIL = 'cool-off-until';
const KEY_PENDING_REVIEW = 'pending-review';

// ---------------------------------------------------------------------------
// 1. SignalPollerService
// ---------------------------------------------------------------------------

export class SignalPollerService extends Service {
  static serviceType = 'signal-poller';
  capabilityDescription =
    'Polls the Trading Caller API for new trading signals every 5 minutes and queues them for evaluation.';

  private apiUrl: string;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(runtime: IAgentRuntime) {
    super(runtime);
    const setting = runtime.getSetting('TRADING_CALLER_API_URL');
    this.apiUrl = typeof setting === 'string' && setting.length > 0 ? setting : DEFAULT_API_URL;
  }

  static async start(runtime: IAgentRuntime): Promise<SignalPollerService> {
    logger.info('Starting SignalPollerService');
    const service = new SignalPollerService(runtime);
    await service.beginPolling();
    return service;
  }

  static async stop(runtime: IAgentRuntime): Promise<void> {
    logger.info('Stopping SignalPollerService (static)');
    const service = runtime.getService<SignalPollerService>(SignalPollerService.serviceType);
    if (service) {
      await service.stop();
    }
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('SignalPollerService stopped');
    }
  }

  private async beginPolling(): Promise<void> {
    const intervalSeconds = POLL_INTERVAL_MS / 1000;
    logger.info(
      { url: `${this.apiUrl}/signals/latest`, intervalSeconds },
      'SignalPollerService polling started'
    );
    await this.poll();
    this.intervalId = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  private async poll(): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/signals/latest`);
      if (!response.ok) {
        logger.error({ status: response.status }, 'SignalPoller: API returned non-OK status');
        return;
      }

      const data: SignalsApiResponse = await response.json();
      if (!data.success || !data.signals?.length) return;

      // Load previously seen signal IDs
      const seenIds: Set<string> = new Set(storeGet<string[]>(KEY_SEEN_SIGNAL_IDS) ?? []);

      // Filter to only new signals
      const newSignals = data.signals.filter((s) => !seenIds.has(s.id));
      if (newSignals.length === 0) return;

      logger.info({ count: newSignals.length }, 'SignalPoller: new signals found');

      // Mark as seen (bounded to last SEEN_SIGNALS_MAX)
      for (const s of newSignals) seenIds.add(s.id);
      const seenArray = [...seenIds].slice(-SEEN_SIGNALS_MAX);
      storeSet(KEY_SEEN_SIGNAL_IDS, seenArray);

      // Append to pending signals queue
      const pending: TradingSignal[] = storeGet<TradingSignal[]>(KEY_PENDING_SIGNALS) ?? [];
      pending.push(...newSignals);
      storeSet(KEY_PENDING_SIGNALS, pending);

      logger.info({ queueSize: pending.length }, 'SignalPoller: pending queue updated');
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        'SignalPoller: poll error'
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 2. executeTrade Action
// ---------------------------------------------------------------------------

const executeTrade: Action = {
  name: 'EXECUTE_TRADE',
  description:
    'Process pending trading signals from the queue. Validates against strategy config (confidence, position limits, cool-off), calculates position size, and executes trade in paper or live mode.',
  similes: ['TRADE', 'BUY_TOKEN', 'SELL_TOKEN', 'OPEN_POSITION', 'PROCESS_SIGNALS'],

  validate: async (_runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    const text = (message.content?.text || '').toLowerCase();
    return (
      text.includes('signal') ||
      text.includes('trade') ||
      text.includes('execute') ||
      text.includes('process')
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: HandlerOptions,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    try {
      const modeSetting = runtime.getSetting('TRADING_MODE');
      const tradingMode = typeof modeSetting === 'string' ? modeSetting : 'paper';

      // Load pending signals
      const pending: TradingSignal[] = storeGet<TradingSignal[]>(KEY_PENDING_SIGNALS) ?? [];

      if (pending.length === 0) {
        if (callback) {
          await callback({ text: 'No pending signals to process.', source: message.content.source });
        }
        return { success: true, text: 'No pending signals to process.' };
      }

      // Load strategy config
      const config: StrategyConfig =
        storeGet<StrategyConfig>(KEY_STRATEGY_CONFIG) ?? { ...DEFAULT_STRATEGY_CONFIG };

      // Load open trades
      const openTrades: TradeRecord[] = storeGet<TradeRecord[]>(KEY_OPEN_TRADES) ?? [];

      // Check cool-off
      const coolOffUntil = storeGet<number>(KEY_COOL_OFF_UNTIL);
      if (coolOffUntil && Date.now() < coolOffUntil) {
        const minsLeft = Math.ceil((coolOffUntil - Date.now()) / 60_000);
        const msg = `Cool-off active. ${minsLeft}m remaining. Skipping all signals.`;
        storeSet(KEY_PENDING_SIGNALS, []);
        if (callback) await callback({ text: msg, source: message.content.source });
        return { success: true, text: msg };
      }

      const results: string[] = [];
      const journal: TradeRecord[] = storeGet<TradeRecord[]>(KEY_TRADE_JOURNAL) ?? [];

      for (const signal of pending) {
        // Filter: confidence
        if (signal.confidence < config.minConfidence) {
          results.push(
            `SKIP ${signal.token.symbol}: confidence ${signal.confidence} < ${config.minConfidence}`
          );
          continue;
        }

        // Filter: max open positions
        if (openTrades.length >= config.maxOpenPositions) {
          results.push(
            `SKIP ${signal.token.symbol}: max open positions (${config.maxOpenPositions}) reached`
          );
          continue;
        }

        // Filter: already have a position in this token
        if (openTrades.some((t) => t.signal.token.address === signal.token.address)) {
          results.push(`SKIP ${signal.token.symbol}: already have an open position`);
          continue;
        }

        // Calculate position size
        const positionPct =
          signal.confidence >= 80 ? config.highConfidencePositionPct : config.defaultPositionPct;
        const positionSizeUSD = (PAPER_PORTFOLIO_VALUE_USD * positionPct) / 100;
        const positionSizeTokens = positionSizeUSD / signal.entry;

        // Execute
        if (tradingMode === 'live') {
          results.push(
            `LIVE TRADE ${signal.action} ${signal.token.symbol} -- Jupiter swap not yet wired`
          );
          continue;
        }

        // Paper trade -- record it
        const trade: TradeRecord = {
          id: crypto.randomUUID(),
          signalId: signal.id,
          signal,
          mode: tradingMode as 'paper' | 'live',
          entryPrice: signal.entry,
          positionSizeUSD,
          positionSizeTokens,
          status: 'open',
          entryTimestamp: Date.now(),
        };

        openTrades.push(trade);
        journal.push(trade);

        results.push(
          `${signal.action} ${signal.token.symbol} @ $${signal.entry} | ` +
            `$${positionSizeUSD.toFixed(0)} (${positionPct}%) | ` +
            `SL: $${signal.stopLoss} | TP: $${signal.targets[0]}/$${signal.targets[1]}/$${signal.targets[2]} | ` +
            `Confidence: ${signal.confidence} | Mode: ${tradingMode}`
        );
      }

      // Persist state
      storeSet(KEY_OPEN_TRADES, openTrades);
      storeSet(KEY_TRADE_JOURNAL, journal);
      storeSet(KEY_PENDING_SIGNALS, []);

      const summary = `Processed ${pending.length} signal(s):\n${results.map((r) => `- ${r}`).join('\n')}`;

      if (callback) {
        await callback({
          text: summary,
          source: message.content.source,
          actions: ['EXECUTE_TRADE'],
        });
      }

      return {
        success: true,
        text: summary,
        values: { tradesOpened: openTrades.length, signalsProcessed: pending.length },
        data: { actionName: 'EXECUTE_TRADE', results },
      };
    } catch (error) {
      const errMsg = `Trade execution failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error({ error }, 'EXECUTE_TRADE handler error');
      if (callback) await callback({ text: errMsg, source: message.content.source });
      return {
        success: false,
        text: errMsg,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: { text: 'Process pending signals and execute qualifying trades.' },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Processed 3 signal(s):\n- LONG SOL @ $148.50 | $80 (8%) | SL: $142.00 | TP: $155/$162/$170 | Confidence: 85 | Mode: paper',
          actions: ['EXECUTE_TRADE'],
        },
      },
    ],
  ],
};

// ---------------------------------------------------------------------------
// 3. closeTrade Action
// ---------------------------------------------------------------------------

const closeTrade: Action = {
  name: 'CLOSE_TRADE',
  description:
    'Close an open trade position. Calculates PnL, updates the trade journal, and triggers cool-off if consecutive losses exceed threshold.',
  similes: ['EXIT_POSITION', 'CLOSE_POSITION', 'TAKE_PROFIT', 'STOP_LOSS'],

  validate: async (_runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    const text = (message.content?.text || '').toLowerCase();
    return text.includes('close') || text.includes('exit') || text.includes('stop');
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: HandlerOptions,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    try {
      const text = message.content.text || '';
      const tradeIdMatch = text.match(/trade[_\s-]*id[:\s]*([a-f0-9-]+)/i);
      const priceMatch = text.match(/(?:price|at|@)\s*\$?([\d.]+)/i);

      if (!tradeIdMatch || !priceMatch) {
        const hint = "Provide trade ID and exit price. Example: 'Close trade_id abc-123 at $268'";
        if (callback) await callback({ text: hint, source: message.content.source });
        return { success: false, text: hint };
      }

      const tradeId = tradeIdMatch[1];
      const exitPrice = parseFloat(priceMatch[1]);

      // Load open trades
      const openTrades: TradeRecord[] = storeGet<TradeRecord[]>(KEY_OPEN_TRADES) ?? [];
      const tradeIndex = openTrades.findIndex((t) => t.id === tradeId);

      if (tradeIndex === -1) {
        const msg = `Trade ${tradeId} not found in open positions.`;
        if (callback) await callback({ text: msg, source: message.content.source });
        return { success: false, text: msg };
      }

      const trade = openTrades[tradeIndex];

      // Calculate PnL
      const pnl =
        trade.signal.action === 'LONG'
          ? (exitPrice - trade.entryPrice) * trade.positionSizeTokens
          : (trade.entryPrice - exitPrice) * trade.positionSizeTokens;
      const pnlPercent = (pnl / trade.positionSizeUSD) * 100;

      // Determine close status
      let status: TradeRecord['status'] = 'closed';
      if (trade.signal.action === 'LONG') {
        if (exitPrice <= trade.signal.stopLoss) status = 'stopped_out';
        else if (exitPrice >= trade.signal.targets[2]) status = 'tp3_hit';
        else if (exitPrice >= trade.signal.targets[1]) status = 'tp2_hit';
        else if (exitPrice >= trade.signal.targets[0]) status = 'tp1_hit';
      } else {
        if (exitPrice >= trade.signal.stopLoss) status = 'stopped_out';
        else if (exitPrice <= trade.signal.targets[2]) status = 'tp3_hit';
        else if (exitPrice <= trade.signal.targets[1]) status = 'tp2_hit';
        else if (exitPrice <= trade.signal.targets[0]) status = 'tp1_hit';
      }

      // Update trade record
      trade.exitPrice = exitPrice;
      trade.pnl = pnl;
      trade.pnlPercent = pnlPercent;
      trade.status = status;
      trade.exitTimestamp = Date.now();

      // Remove from open trades
      openTrades.splice(tradeIndex, 1);
      storeSet(KEY_OPEN_TRADES, openTrades);

      // Update journal
      const journal: TradeRecord[] = storeGet<TradeRecord[]>(KEY_TRADE_JOURNAL) ?? [];
      const journalIndex = journal.findIndex((t) => t.id === tradeId);
      if (journalIndex !== -1) {
        journal[journalIndex] = trade;
      }
      storeSet(KEY_TRADE_JOURNAL, journal);

      // Check consecutive losses for cool-off
      const closedTrades = journal.filter((t) => t.status !== 'open').slice(-10);
      let consecutiveLosses = 0;
      for (let i = closedTrades.length - 1; i >= 0; i--) {
        if ((closedTrades[i].pnl ?? 0) < 0) consecutiveLosses++;
        else break;
      }

      const config: StrategyConfig =
        storeGet<StrategyConfig>(KEY_STRATEGY_CONFIG) ?? { ...DEFAULT_STRATEGY_CONFIG };

      let coolOffTriggered = false;
      if (consecutiveLosses >= config.coolOffAfterConsecutiveLosses) {
        const coolOffUntil = Date.now() + config.coolOffDurationMs;
        storeSet(KEY_COOL_OFF_UNTIL, coolOffUntil);
        coolOffTriggered = true;
      }

      // Flag for evaluator
      storeSet(KEY_PENDING_REVIEW, true);

      const outcome = pnl >= 0 ? 'WIN' : 'LOSS';
      const pnlSign = pnl >= 0 ? '+' : '';
      const summary =
        `Trade closed [${outcome}]:\n` +
        `- ${trade.signal.action} ${trade.signal.token.symbol}: $${trade.entryPrice} -> $${exitPrice}\n` +
        `- PnL: ${pnlSign}$${pnl.toFixed(2)} (${pnlSign}${pnlPercent.toFixed(1)}%)\n` +
        `- Status: ${status}\n` +
        `- Mode: ${trade.mode}` +
        (coolOffTriggered
          ? `\n- Cool-off activated (${consecutiveLosses} consecutive losses)`
          : '');

      if (callback) {
        await callback({
          text: summary,
          source: message.content.source,
          actions: ['CLOSE_TRADE'],
        });
      }

      return {
        success: true,
        text: summary,
        values: { tradeId, pnl, pnlPercent, status },
        data: { actionName: 'CLOSE_TRADE', trade },
      };
    } catch (error) {
      const errMsg = `Error closing trade: ${error instanceof Error ? error.message : String(error)}`;
      logger.error({ error }, 'CLOSE_TRADE handler error');
      if (callback) await callback({ text: errMsg, source: message.content.source });
      return {
        success: false,
        text: errMsg,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: { text: 'Close trade_id abc-123 at $268' },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Trade closed [WIN]:\n- LONG SOL: $245.00 -> $268.00\n- PnL: +$7.52 (+15.3%)\n- Status: tp2_hit\n- Mode: paper',
          actions: ['CLOSE_TRADE'],
        },
      },
    ],
  ],
};

// ---------------------------------------------------------------------------
// 4. reviewPerformance Action
// ---------------------------------------------------------------------------

const reviewPerformance: Action = {
  name: 'REVIEW_PERFORMANCE',
  description:
    'Self-learning: Reviews recent trades, computes statistics (win rate, PnL, profit factor), and prepares data for LLM-driven strategy optimization.',
  similes: ['ANALYZE_TRADES', 'OPTIMIZE_STRATEGY', 'LEARN', 'SELF_IMPROVE'],

  validate: async (_runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    const text = (message.content?.text || '').toLowerCase();
    return (
      text.includes('review') ||
      text.includes('performance') ||
      text.includes('learn') ||
      text.includes('optimize')
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: HandlerOptions,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    try {
      const journal: TradeRecord[] = storeGet<TradeRecord[]>(KEY_TRADE_JOURNAL) ?? [];
      const closedTrades = journal.filter((t) => t.status !== 'open');

      if (closedTrades.length < MIN_TRADES_FOR_REVIEW) {
        const msg = `Not enough closed trades to review. Need at least ${MIN_TRADES_FOR_REVIEW}.`;
        if (callback) await callback({ text: msg, source: message.content.source });
        return { success: true, text: msg };
      }

      const wins = closedTrades.filter((t) => (t.pnl ?? 0) > 0);
      const losses = closedTrades.filter((t) => (t.pnl ?? 0) <= 0);
      const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
      const winSum = wins.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
      const lossSum = Math.abs(losses.reduce((sum, t) => sum + (t.pnl ?? 0), 0));
      const stoppedOut = closedTrades.filter((t) => t.status === 'stopped_out');
      const tpHits = closedTrades.filter((t) => t.status.startsWith('tp'));

      const winRatePct = ((wins.length / closedTrades.length) * 100).toFixed(1);
      const avgWin = wins.length ? (winSum / wins.length).toFixed(2) : '0.00';
      const avgLoss = losses.length
        ? (losses.reduce((sum, t) => sum + (t.pnl ?? 0), 0) / losses.length).toFixed(2)
        : '0.00';
      const profitFactor = lossSum > 0 ? (winSum / lossSum).toFixed(2) : 'N/A';
      const stopOutRatePct = ((stoppedOut.length / closedTrades.length) * 100).toFixed(1);
      const tpHitRatePct = ((tpHits.length / closedTrades.length) * 100).toFixed(1);

      const config: StrategyConfig =
        storeGet<StrategyConfig>(KEY_STRATEGY_CONFIG) ?? { ...DEFAULT_STRATEGY_CONFIG };

      const summary =
        `Performance Review:\n` +
        `- Trades: ${closedTrades.length} | Win rate: ${winRatePct}%\n` +
        `- PnL: $${totalPnL.toFixed(2)} | Profit factor: ${profitFactor}\n` +
        `- Avg win: $${avgWin} | Avg loss: $${avgLoss}\n` +
        `- Stop-out rate: ${stopOutRatePct}% | TP rate: ${tpHitRatePct}%\n` +
        `- Strategy version: ${config.version} | Min confidence: ${config.minConfidence}\n\n` +
        `Analyzing patterns for strategy optimization...`;

      if (callback) {
        await callback({
          text: summary,
          source: message.content.source,
          actions: ['REVIEW_PERFORMANCE'],
        });
      }

      // Clear pending review flag
      storeSet(KEY_PENDING_REVIEW, false);

      // LLM-based strategy optimization placeholder:
      // 1. Build prompt with stats + last 10 trades + current config
      // 2. Call runtime.useModel() to suggest config changes
      // 3. Parse suggested config changes
      // 4. Save updated config to store
      // Wired up once ElizaOS runtime LLM calls are confirmed working.

      return {
        success: true,
        text: summary,
        values: {
          totalTrades: closedTrades.length,
          winRate: winRatePct,
          totalPnL: totalPnL.toFixed(2),
          profitFactor,
        },
        data: {
          actionName: 'REVIEW_PERFORMANCE',
          stats: {
            totalTrades: closedTrades.length,
            wins: wins.length,
            losses: losses.length,
            totalPnL,
            winRatePct,
            avgWin,
            avgLoss,
            profitFactor,
            stopOutRatePct,
            tpHitRatePct,
          },
        },
      };
    } catch (error) {
      const errMsg = `Performance review failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error({ error }, 'REVIEW_PERFORMANCE handler error');
      if (callback) await callback({ text: errMsg, source: message.content.source });
      return {
        success: false,
        text: errMsg,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: { text: 'Review performance and optimize strategy.' },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Performance Review:\n- Trades: 12 | Win rate: 66.7%\n- PnL: $47.23 | Profit factor: 2.14\n- Avg win: $9.32 | Avg loss: -$3.18\n- Stop-out rate: 16.7% | TP rate: 50.0%\n- Strategy version: 1 | Min confidence: 60',
          actions: ['REVIEW_PERFORMANCE'],
        },
      },
    ],
  ],
};

// ---------------------------------------------------------------------------
// 5. signalProvider
// ---------------------------------------------------------------------------

const signalProvider: Provider = {
  name: 'TRADING_SIGNALS',
  description: 'Injects pending signals and open positions into agent context',

  get: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State
  ): Promise<ProviderResult> => {
    try {
      const pending: TradingSignal[] = storeGet<TradingSignal[]>(KEY_PENDING_SIGNALS) ?? [];
      const openTrades: TradeRecord[] = storeGet<TradeRecord[]>(KEY_OPEN_TRADES) ?? [];

      if (pending.length === 0 && openTrades.length === 0) {
        return { text: 'No pending signals or open positions.' };
      }

      const parts: string[] = [];

      if (pending.length > 0) {
        parts.push(`PENDING SIGNALS (${pending.length}):`);
        for (const s of pending) {
          parts.push(
            `  ${s.action} ${s.token.symbol} @ $${s.entry} | Confidence: ${s.confidence} | SL: $${s.stopLoss} | TP: $${s.targets.join('/$')}`
          );
        }
      }

      if (openTrades.length > 0) {
        parts.push(`\nOPEN POSITIONS (${openTrades.length}):`);
        for (const t of openTrades) {
          const ageMinutes = ((Date.now() - t.entryTimestamp) / 60_000).toFixed(0);
          parts.push(
            `  ${t.signal.action} ${t.signal.token.symbol} @ $${t.entryPrice} | $${t.positionSizeUSD.toFixed(0)} | ${ageMinutes}m ago | ${t.mode}`
          );
        }
      }

      return {
        text: parts.join('\n'),
        values: { pendingCount: pending.length, openPositions: openTrades.length },
        data: { pending, openTrades },
      };
    } catch {
      return { text: 'Error loading trading signals.' };
    }
  },
};

// ---------------------------------------------------------------------------
// 6. portfolioProvider
// ---------------------------------------------------------------------------

const portfolioProvider: Provider = {
  name: 'PORTFOLIO_STATUS',
  description: 'Injects portfolio balance, trade stats, and strategy config into agent context',

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State
  ): Promise<ProviderResult> => {
    try {
      const openTrades: TradeRecord[] = storeGet<TradeRecord[]>(KEY_OPEN_TRADES) ?? [];
      const journal: TradeRecord[] = storeGet<TradeRecord[]>(KEY_TRADE_JOURNAL) ?? [];
      const config: StrategyConfig =
        storeGet<StrategyConfig>(KEY_STRATEGY_CONFIG) ?? { ...DEFAULT_STRATEGY_CONFIG };

      const modeSetting = runtime.getSetting('TRADING_MODE');
      const tradingMode = typeof modeSetting === 'string' ? modeSetting : 'paper';
      const closed = journal.filter((t) => t.status !== 'open');
      const totalPnL = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
      const winRate =
        closed.length > 0
          ? ((closed.filter((t) => (t.pnl ?? 0) > 0).length / closed.length) * 100).toFixed(1)
          : '0.0';

      const text =
        `PORTFOLIO:\n` +
        `- Mode: ${tradingMode}\n` +
        `- Open positions: ${openTrades.length}/${config.maxOpenPositions}\n` +
        `- Closed trades: ${closed.length}\n` +
        `- PnL: $${totalPnL.toFixed(2)} | Win rate: ${winRate}%\n` +
        `- Strategy v${config.version}: min confidence ${config.minConfidence}, position ${config.defaultPositionPct}%/${config.highConfidencePositionPct}%`;

      return {
        text,
        values: {
          tradingMode,
          openPositions: openTrades.length,
          closedTrades: closed.length,
          totalPnL: totalPnL.toFixed(2),
          winRate,
          strategyVersion: config.version,
        },
        data: { config },
      };
    } catch {
      return { text: 'Error loading portfolio status.' };
    }
  },
};

// ---------------------------------------------------------------------------
// 7. tradeEvaluator
// ---------------------------------------------------------------------------

const tradeEvaluator: Evaluator = {
  name: 'TRADE_PERFORMANCE_EVALUATOR',
  description:
    'Checks for closed trades that need performance review and flags the self-learning loop when a significant performance shift is detected.',

  examples: [
    {
      prompt: 'After a trade has been closed, check if performance review is needed.',
      messages: [{ name: 'Agent Fox', content: { text: 'Trade closed.' } }],
      outcome:
        'Flags pending review for strategy optimization when performance shift exceeds threshold.',
    },
  ],

  validate: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State
  ): Promise<boolean> => {
    return storeGet<boolean>(KEY_PENDING_REVIEW) === true;
  },

  handler: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: HandlerOptions,
    _callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult | void> => {
    try {
      const journal: TradeRecord[] = storeGet<TradeRecord[]>(KEY_TRADE_JOURNAL) ?? [];
      const closed = journal.filter((t) => t.status !== 'open');

      if (closed.length < MIN_TRADES_FOR_REVIEW) return;

      const recent = closed.slice(-RECENT_TRADES_WINDOW);
      const recentWinRate =
        (recent.filter((t) => (t.pnl ?? 0) > 0).length / recent.length) * 100;
      const overallWinRate =
        (closed.filter((t) => (t.pnl ?? 0) > 0).length / closed.length) * 100;

      if (Math.abs(recentWinRate - overallWinRate) > PERFORMANCE_SHIFT_THRESHOLD) {
        logger.info(
          {
            recentWinRate: recentWinRate.toFixed(1),
            overallWinRate: overallWinRate.toFixed(1),
          },
          'TradeEvaluator: performance shift detected'
        );
      }

      storeSet(KEY_PENDING_REVIEW, false);
    } catch (error) {
      logger.error({ error }, 'TradeEvaluator error');
    }
  },
};

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

const tradingCallerPlugin: Plugin = {
  name: 'trading-caller',
  description:
    'Consumes signals from Trading Caller API, executes trades on Solana (paper or live), tracks performance, and self-learns from outcomes.',

  config: {
    TRADING_CALLER_API_URL: process.env.TRADING_CALLER_API_URL ?? null,
    TRADING_MODE: process.env.TRADING_MODE ?? 'paper',
  },

  async init(config: Record<string, string>) {
    logger.info('Initializing trading-caller plugin');
    if (config.TRADING_CALLER_API_URL) {
      process.env.TRADING_CALLER_API_URL = config.TRADING_CALLER_API_URL;
    }
    if (config.TRADING_MODE) {
      process.env.TRADING_MODE = config.TRADING_MODE;
    }
  },

  services: [SignalPollerService],
  actions: [executeTrade, closeTrade, reviewPerformance],
  providers: [signalProvider, portfolioProvider],
  evaluators: [tradeEvaluator],
};

export default tradingCallerPlugin;
