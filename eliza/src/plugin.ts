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
  ModelType,
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
import {
  storeGet,
  storeSet,
  KEY_SEEN_SIGNAL_IDS,
  KEY_PENDING_SIGNALS,
  KEY_OPEN_TRADES,
  KEY_TRADE_JOURNAL,
  KEY_STRATEGY_CONFIG,
  KEY_COOL_OFF_UNTIL,
  KEY_AGENT_MEMORIES,
  KEY_PENDING_REVIEW,
} from './trade-store.ts';
import { PositionMonitorService } from './position-monitor.ts';
import { VolumeWatcherService } from './volume-watcher.ts';
import { broadcastTradeOpened, broadcastTradeClosed, computePortfolioStats } from './social-broadcast.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_API_URL =
  process.env.TRADING_CALLER_API_URL || 'https://trading-caller-production-d7d3.up.railway.app';
const SEEN_SIGNALS_MAX = 500;
const WS_RECONNECT_DELAY_MS = 5_000;
const MIN_TRADES_FOR_REVIEW = 3;
const RECENT_TRADES_WINDOW = 5;
const PERFORMANCE_SHIFT_THRESHOLD = 20;

/** Simulated portfolio value for paper trading (USD) */
const PAPER_PORTFOLIO_VALUE_USD = 1000;

/** Minimum consecutive wins/losses to trigger a streak memory */
const STREAK_MILESTONE_THRESHOLD = 3;

/** Maximum stored agent memories before oldest are pruned */
const MAX_AGENT_MEMORIES = 100;

// ---------------------------------------------------------------------------
// Agent Memory types
// ---------------------------------------------------------------------------

interface AgentMemory {
  id: string;
  type: 'record_win' | 'record_loss' | 'win_streak' | 'loss_streak' | 'first_token_trade';
  text: string;
  tradeId: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// 1. SignalPollerService
// ---------------------------------------------------------------------------

export class SignalPollerService extends Service {
  static serviceType = 'signal-poller';
  capabilityDescription =
    'Polls the Trading Caller API for new trading signals every 5 minutes and queues them for evaluation.';

  private apiUrl: string;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private ws: InstanceType<typeof import('ws').WebSocket> | null = null;
  private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

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
    }
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    logger.info('SignalPollerService stopped');
  }

  private async beginPolling(): Promise<void> {
    const intervalSeconds = POLL_INTERVAL_MS / 1000;
    logger.info(
      { url: `${this.apiUrl}/signals/latest`, intervalSeconds },
      'SignalPollerService polling started'
    );
    await this.poll();
    this.intervalId = setInterval(() => this.poll(), POLL_INTERVAL_MS);

    // WebSocket for real-time signal push (polling remains as fallback)
    this.connectWebSocket();
  }

  private async connectWebSocket(): Promise<void> {
    try {
      const { default: WebSocket } = await import('ws');

      // Derive WS URL from API URL: http(s) -> ws(s), append /ws path
      const wsUrl = this.apiUrl
        .replace(/^https:/, 'wss:')
        .replace(/^http:/, 'ws:');

      logger.info({ url: wsUrl }, 'SignalPoller: connecting WebSocket');

      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.on('open', () => {
        logger.info('SignalPoller: WebSocket connected');
        socket.send(JSON.stringify({ type: 'subscribe', channel: 'signals' }));
      });

      socket.on('message', (raw: Buffer | string) => {
        try {
          const message = JSON.parse(raw.toString());
          if (message.type !== 'signal' || !message.data) return;

          const signal = message.data as TradingSignal;

          // Reuse existing deduplication via seenIds
          const seenIds: Set<string> = new Set(storeGet<string[]>(KEY_SEEN_SIGNAL_IDS) ?? []);
          if (seenIds.has(signal.id)) return;

          logger.info({ id: signal.id, token: signal.token?.symbol }, 'SignalPoller: signal via WebSocket');

          seenIds.add(signal.id);
          const seenArray = [...seenIds].slice(-SEEN_SIGNALS_MAX);
          storeSet(KEY_SEEN_SIGNAL_IDS, seenArray);

          const pending: TradingSignal[] = storeGet<TradingSignal[]>(KEY_PENDING_SIGNALS) ?? [];
          pending.push(signal);
          storeSet(KEY_PENDING_SIGNALS, pending);
        } catch (err) {
          logger.error(
            { error: err instanceof Error ? err.message : String(err) },
            'SignalPoller: WebSocket message parse error'
          );
        }
      });

      socket.on('close', () => {
        logger.warn('SignalPoller: WebSocket closed, reconnecting...');
        this.ws = null;
        this.scheduleReconnect();
      });

      socket.on('error', (err: Error) => {
        logger.error({ error: err.message }, 'SignalPoller: WebSocket error');
        // close event will fire after error, triggering reconnect
      });
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        'SignalPoller: WebSocket init failed'
      );
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.wsReconnectTimer) return; // already scheduled
    this.wsReconnectTimer = setTimeout(() => {
      this.wsReconnectTimer = null;
      this.connectWebSocket();
    }, WS_RECONNECT_DELAY_MS);
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
          try {
            const { loadWallet } = await import('./wallet.ts');
            const { executeSwap, getQuote } = await import('./jupiter-swap.ts');

            const wallet = loadWallet();
            if (!wallet) {
              results.push(`SKIP ${signal.token.symbol}: SOLANA_PRIVATE_KEY not configured`);
              continue;
            }

            const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
            const inputMint = signal.action === 'LONG' ? USDC_MINT : signal.token.address;
            const outputMint = signal.action === 'LONG' ? signal.token.address : USDC_MINT;

            // USDC has 6 decimals
            const USDC_SMALLEST_UNIT = 1_000_000;
            const amountIn = Math.floor(positionSizeUSD * USDC_SMALLEST_UNIT);

            const quote = await getQuote(inputMint, outputMint, amountIn, 100);
            const swapResult = await executeSwap(quote, wallet);

            const trade: TradeRecord = {
              id: crypto.randomUUID(),
              signalId: signal.id,
              signal,
              mode: 'live',
              entryPrice: signal.entry,
              positionSizeUSD,
              positionSizeTokens,
              entryTxHash: swapResult.txHash,
              status: 'open',
              entryTimestamp: Date.now(),
            };

            openTrades.push(trade);
            journal.push(trade);

            broadcastTradeOpened(runtime, signal, trade).catch(() => {});

            const TX_HASH_PREVIEW_LENGTH = 16;
            results.push(
              `LIVE ${signal.action} ${signal.token.symbol} @ $${signal.entry} | ` +
                `$${positionSizeUSD.toFixed(0)} | TX: ${swapResult.txHash.slice(0, TX_HASH_PREVIEW_LENGTH)}... | ` +
                `Confidence: ${signal.confidence}`
            );
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            results.push(`FAILED ${signal.token.symbol}: ${errMsg}`);
            logger.error({ error, signal: signal.id }, 'Live trade execution failed');
          }
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

        broadcastTradeOpened(runtime, signal, trade).catch(() => {});

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
// Helpers
// ---------------------------------------------------------------------------

const MINUTES_PER_HOUR = 60;
const MS_PER_MINUTE = 60_000;

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / MS_PER_MINUTE);
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const remainingMins = minutes % MINUTES_PER_HOUR;
  if (hours > 0) return `${hours}h ${remainingMins}m`;
  return `${minutes}m`;
}

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

      // Execute on-chain swap for live trades (full position close)
      let exitTxHash: string | undefined;
      if (trade.mode === 'live') {
        const { loadWallet } = await import('./wallet.ts');
        const { executeSwap, getQuote } = await import('./jupiter-swap.ts');

        const wallet = loadWallet();
        if (!wallet) {
          const msg = `Cannot close live trade ${tradeId}: SOLANA_PRIVATE_KEY not configured`;
          if (callback) await callback({ text: msg, source: message.content.source });
          return { success: false, text: msg };
        }

        const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        // Reverse of entry: LONG exit sells token for USDC
        const inputMint = trade.signal.action === 'LONG' ? trade.signal.token.address : USDC_MINT;
        const outputMint = trade.signal.action === 'LONG' ? USDC_MINT : trade.signal.token.address;

        // Sell entire token position (need token decimals for amount)
        const TOKEN_DECIMALS = trade.signal.token.decimals;
        const amountIn = Math.floor(trade.positionSizeTokens * 10 ** TOKEN_DECIMALS);

        const quote = await getQuote(inputMint, outputMint, amountIn, 100);
        const swapResult = await executeSwap(quote, wallet);
        exitTxHash = swapResult.txHash;
      }

      // Update trade record
      trade.exitPrice = exitPrice;
      trade.pnl = pnl;
      trade.pnlPercent = pnlPercent;
      trade.status = status;
      trade.exitTimestamp = Date.now();
      if (exitTxHash) trade.exitTxHash = exitTxHash;

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

      const portfolioStats = computePortfolioStats(journal);
      broadcastTradeClosed(runtime, trade, portfolioStats).catch(() => {});

      // --- Agent personality memory creation (best-effort, never throws) ---
      try {
        const memories: AgentMemory[] = storeGet<AgentMemory[]>(KEY_AGENT_MEMORIES) ?? [];
        const closedForMemory = journal.filter(t => t.status !== 'open' && t.pnl !== undefined);

        // Record win / record loss — compare against all *previous* closed trades
        if (closedForMemory.length > 1) {
          const previousPnls = closedForMemory.slice(0, -1).map(t => t.pnl!);
          const maxPnl = Math.max(...previousPnls);
          const minPnl = Math.min(...previousPnls);

          if (pnl > maxPnl) {
            memories.push({
              id: crypto.randomUUID(),
              type: 'record_win',
              text: `New record win: +$${pnl.toFixed(2)} (+${pnlPercent.toFixed(1)}%) on ${trade.signal.token.symbol} ${trade.signal.action}. Previous best: +$${maxPnl.toFixed(2)}.`,
              tradeId: trade.id,
              timestamp: Date.now(),
            });
          }
          if (pnl < minPnl) {
            memories.push({
              id: crypto.randomUUID(),
              type: 'record_loss',
              text: `New worst loss: $${pnl.toFixed(2)} (${pnlPercent.toFixed(1)}%) on ${trade.signal.token.symbol} ${trade.signal.action}. Previous worst: $${minPnl.toFixed(2)}.`,
              tradeId: trade.id,
              timestamp: Date.now(),
            });
          }
        }

        // Streak milestone — count consecutive same-outcome trades from the end
        let streak = 0;
        const isWin = pnl > 0;
        for (let i = closedForMemory.length - 1; i >= 0; i--) {
          if ((closedForMemory[i].pnl! > 0) === isWin) streak++;
          else break;
        }
        if (streak >= STREAK_MILESTONE_THRESHOLD) {
          memories.push({
            id: crypto.randomUUID(),
            type: isWin ? 'win_streak' : 'loss_streak',
            text: `${streak} consecutive ${isWin ? 'wins' : 'losses'}. ${isWin ? 'Model confirmed.' : 'Cool-off may be warranted.'}`,
            tradeId: trade.id,
            timestamp: Date.now(),
          });
        }

        // First trade on a specific token
        const tokenTrades = closedForMemory.filter(
          t => t.signal.token.address === trade.signal.token.address,
        );
        if (tokenTrades.length === 1) {
          memories.push({
            id: crypto.randomUUID(),
            type: 'first_token_trade',
            text: `First trade on ${trade.signal.token.symbol}. ${pnl >= 0 ? 'Winner' : 'Loser'}: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}.`,
            tradeId: trade.id,
            timestamp: Date.now(),
          });
        }

        storeSet(KEY_AGENT_MEMORIES, memories.slice(-MAX_AGENT_MEMORIES));
      } catch (memoryError) {
        logger.error(
          { error: memoryError instanceof Error ? memoryError.message : String(memoryError) },
          'Agent memory creation failed (non-fatal)',
        );
      }

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
      const TX_HASH_PREVIEW_LENGTH = 16;

      // Generate trade journal narrative (best-effort, non-blocking)
      let narrative = '';
      try {
        const durationMs = (trade.exitTimestamp ?? Date.now()) - trade.entryTimestamp;
        const durationStr = formatDuration(durationMs);
        const technicalReasoning = trade.signal.reasoning?.technical ?? 'N/A';

        const narrativePrompt =
          `Generate a 2-3 sentence trade narrative in Agent Fox's voice.\n` +
          `Rules: Numbers first, exact figures, signed PnL, no emotion, dry/factual tone.\n` +
          `Never use "I feel", "excited", "disappointed". Use "confirmed", "executed", "as designed".\n\n` +
          `Trade data:\n` +
          `- Token: ${trade.signal.token.symbol} ${trade.signal.action}\n` +
          `- Entry: $${trade.entryPrice} → Exit: $${exitPrice}\n` +
          `- PnL: ${pnlSign}$${pnl.toFixed(2)} (${pnlSign}${pnlPercent.toFixed(1)}%)\n` +
          `- Duration: ${durationStr}\n` +
          `- Status: ${status}\n` +
          `- Confidence: ${trade.signal.confidence}\n` +
          `- Technical: ${technicalReasoning}`;

        const llmResponse = await runtime.useModel(ModelType.TEXT_LARGE, {
          prompt: narrativePrompt,
          temperature: 0.4,
          maxTokens: 256,
        });

        const responseText = typeof llmResponse === 'string' ? llmResponse.trim() : '';
        if (responseText.length > 0) {
          narrative = responseText;
        }
      } catch (narrativeError) {
        logger.error(
          { error: narrativeError instanceof Error ? narrativeError.message : String(narrativeError) },
          'Trade narrative generation failed (non-fatal)'
        );
      }

      const summary =
        `Trade closed [${outcome}]:\n` +
        `- ${trade.signal.action} ${trade.signal.token.symbol}: $${trade.entryPrice} -> $${exitPrice}\n` +
        `- PnL: ${pnlSign}$${pnl.toFixed(2)} (${pnlSign}${pnlPercent.toFixed(1)}%)\n` +
        `- Status: ${status}\n` +
        `- Mode: ${trade.mode}` +
        (exitTxHash
          ? `\n- TX: ${exitTxHash.slice(0, TX_HASH_PREVIEW_LENGTH)}...`
          : '') +
        (coolOffTriggered
          ? `\n- Cool-off activated (${consecutiveLosses} consecutive losses)`
          : '') +
        (narrative.length > 0
          ? `\n\n${narrative}`
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

      // ----- LLM-driven strategy optimization -----
      let optimizationSummary = '';
      try {
        const LAST_N_TRADES_FOR_OPTIMIZATION = 10;
        const recentClosed = closedTrades.slice(-LAST_N_TRADES_FOR_OPTIMIZATION);

        const tradeSnapshots = recentClosed.map((t) => ({
          token: t.signal.token.symbol,
          direction: t.signal.action,
          confidence: t.signal.confidence,
          pnl: (t.pnl ?? 0).toFixed(2),
          status: t.status,
          durationMs: t.exitTimestamp && t.entryTimestamp
            ? t.exitTimestamp - t.entryTimestamp
            : null,
        }));

        const optimizationPrompt =
          `You are a quantitative trading strategist optimizing an automated trading agent.\n\n` +
          `CURRENT STRATEGY CONFIG (v${config.version}):\n` +
          `  minConfidence: ${config.minConfidence}\n` +
          `  defaultPositionPct: ${config.defaultPositionPct}\n` +
          `  highConfidencePositionPct: ${config.highConfidencePositionPct}\n` +
          `  maxOpenPositions: ${config.maxOpenPositions}\n` +
          `  coolOffAfterConsecutiveLosses: ${config.coolOffAfterConsecutiveLosses}\n\n` +
          `PERFORMANCE STATS:\n` +
          `  Win rate: ${winRatePct}%\n` +
          `  Total PnL: $${totalPnL.toFixed(2)}\n` +
          `  Profit factor: ${profitFactor}\n` +
          `  Avg win: $${avgWin} | Avg loss: $${avgLoss}\n` +
          `  Stop-out rate: ${stopOutRatePct}% | TP rate: ${tpHitRatePct}%\n\n` +
          `LAST ${recentClosed.length} CLOSED TRADES:\n` +
          `${JSON.stringify(tradeSnapshots, null, 2)}\n\n` +
          `Analyze the performance and suggest parameter changes to improve results.\n` +
          `Only suggest changes if the data supports them. If performance is already good, return no changes.\n` +
          `Allowed parameters: minConfidence (50-90), defaultPositionPct (1-15), ` +
          `highConfidencePositionPct (2-15), maxOpenPositions (1-10), coolOffAfterConsecutiveLosses (2-5).\n\n` +
          `Respond with ONLY valid JSON, no markdown fences:\n` +
          `{"changes":[{"param":"<name>","from":<current>,"to":<new>,"reason":"<short reason>"}]}`;

        const llmResponse = await runtime.useModel(ModelType.TEXT_LARGE, {
          prompt: optimizationPrompt,
          temperature: 0.3,
          maxTokens: 512,
        });

        const responseText = typeof llmResponse === 'string' ? llmResponse : '';

        // Extract JSON from response (tolerant of leading/trailing whitespace or fences)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as {
            changes?: Array<{ param: string; from: number; to: number; reason: string }>;
          };

          const TUNABLE_PARAM_RANGES: Record<string, { min: number; max: number }> = {
            minConfidence: { min: 50, max: 90 },
            defaultPositionPct: { min: 1, max: 15 },
            highConfidencePositionPct: { min: 2, max: 15 },
            maxOpenPositions: { min: 1, max: 10 },
            coolOffAfterConsecutiveLosses: { min: 2, max: 5 },
          };

          if (parsed.changes && Array.isArray(parsed.changes) && parsed.changes.length > 0) {
            const appliedChanges: string[] = [];
            const updatedConfig = { ...config };

            for (const change of parsed.changes) {
              const range = TUNABLE_PARAM_RANGES[change.param];
              if (!range) continue; // skip unknown params

              const clamped = Math.round(
                Math.min(range.max, Math.max(range.min, change.to))
              );

              // Only apply if actually different from current value
              if (clamped !== (updatedConfig as Record<string, unknown>)[change.param]) {
                (updatedConfig as Record<string, unknown>)[change.param] = clamped;
                appliedChanges.push(
                  `${change.param}: ${change.from} -> ${clamped} (${change.reason})`
                );
              }
            }

            if (appliedChanges.length > 0) {
              updatedConfig.version = config.version + 1;
              updatedConfig.lastUpdated = Date.now();
              updatedConfig.updateReason = appliedChanges.join('; ');
              storeSet(KEY_STRATEGY_CONFIG, updatedConfig);

              optimizationSummary =
                `\nStrategy optimized (v${config.version} -> v${updatedConfig.version}):\n` +
                appliedChanges.map((c) => `- ${c}`).join('\n');

              logger.info(
                { from: config.version, to: updatedConfig.version, changes: appliedChanges },
                'LLM strategy optimization applied'
              );
            } else {
              optimizationSummary = '\nLLM review: no parameter changes needed.';
            }
          } else {
            optimizationSummary = '\nLLM review: no parameter changes suggested.';
          }
        } else {
          logger.warn('LLM optimization: could not extract JSON from response');
          optimizationSummary = '\nLLM review: could not parse optimization response.';
        }
      } catch (llmError) {
        logger.error(
          { error: llmError instanceof Error ? llmError.message : String(llmError) },
          'LLM strategy optimization failed (non-fatal)'
        );
        optimizationSummary = '\nLLM optimization skipped due to error.';
      }

      const fullSummary = summary + optimizationSummary;

      // Send optimization addendum if we have one
      if (callback && optimizationSummary.length > 0) {
        await callback({
          text: optimizationSummary.trim(),
          source: message.content.source,
          actions: ['REVIEW_PERFORMANCE'],
        });
      }

      return {
        success: true,
        text: fullSummary,
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
// 7. agentMemoryProvider
// ---------------------------------------------------------------------------

const RECENT_MEMORIES_LIMIT = 5;

const agentMemoryProvider: Provider = {
  name: 'AGENT_MEMORY',
  description: 'Notable trading memories that shape Agent Fox personality',

  get: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<ProviderResult> => {
    try {
      const memories: AgentMemory[] = storeGet<AgentMemory[]>(KEY_AGENT_MEMORIES) ?? [];
      if (memories.length === 0) {
        return { text: 'No notable trading memories yet.' };
      }

      const recent = memories.slice(-RECENT_MEMORIES_LIMIT);
      const text = 'NOTABLE MEMORIES:\n' + recent.map(m => `- ${m.text}`).join('\n');
      return { text, values: { memoryCount: memories.length } };
    } catch {
      return { text: 'Error loading agent memories.' };
    }
  },
};

// ---------------------------------------------------------------------------
// 8. tradeEvaluator
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
// 9. whatIfBacktest Action
// ---------------------------------------------------------------------------

const MIN_TRADES_FOR_BACKTEST = 3;
const PERCENTAGE_MULTIPLIER = 100;

/** Regex patterns for extracting parameter name and value from natural language */
const WHAT_IF_PARAM_PATTERNS: Record<string, RegExp> = {
  minConfidence: /confidence\s*(?:to|at|=|was|were|is)?\s*(\d+)/i,
  defaultPositionPct: /(?:position|size)\s*(?:to|at|=|was|were|is)?\s*(\d+)/i,
  maxOpenPositions: /(?:max\s*)?(?:open\s*)?positions?\s*(?:to|at|=|was|were|is)?\s*(\d+)/i,
};

/**
 * Parse the first matching parameter name + numeric value from user text.
 * Returns null when no recognised pattern is found.
 */
function parseWhatIfParam(text: string): { paramName: string; newValue: number } | null {
  for (const [paramName, regex] of Object.entries(WHAT_IF_PARAM_PATTERNS)) {
    const match = text.match(regex);
    if (match) {
      return { paramName, newValue: parseInt(match[1], 10) };
    }
  }
  return null;
}

function formatPnlSign(value: number): string {
  return value >= 0 ? '+' : '';
}

const whatIfBacktest: Action = {
  name: 'WHAT_IF_BACKTEST',
  description:
    'Simulate how a strategy parameter change would have performed against historical signals. ' +
    'Supports minConfidence, defaultPositionPct, and maxOpenPositions.',
  similes: ['BACKTEST', 'SIMULATE', 'WHAT_IF', 'TEST_STRATEGY'],

  validate: async (_runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    const text = (message.content?.text || '').toLowerCase();
    return text.includes('what if') || text.includes('backtest') || text.includes('simulate');
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: HandlerOptions,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    try {
      const text = message.content.text || '';

      // --- Parse parameter change from natural language ---
      const parsed = parseWhatIfParam(text);
      if (!parsed) {
        const hint =
          'Could not parse parameter. Try:\n' +
          '- "What if confidence was 55?"\n' +
          '- "Backtest with position size 10"\n' +
          '- "Simulate max positions 3"';
        if (callback) await callback({ text: hint, source: message.content.source });
        return { success: false, text: hint };
      }

      const { paramName, newValue } = parsed;

      // --- Load trade history ---
      const journal: TradeRecord[] = storeGet<TradeRecord[]>(KEY_TRADE_JOURNAL) ?? [];
      const closedTrades = journal.filter((t) => t.status !== 'open');

      if (closedTrades.length < MIN_TRADES_FOR_BACKTEST) {
        const msg = `Not enough trade history to simulate. Need at least ${MIN_TRADES_FOR_BACKTEST} closed trades.`;
        if (callback) await callback({ text: msg, source: message.content.source });
        return { success: true, text: msg };
      }

      // --- Current config results ---
      const currentConfig: StrategyConfig =
        storeGet<StrategyConfig>(KEY_STRATEGY_CONFIG) ?? { ...DEFAULT_STRATEGY_CONFIG };
      const currentValue = (currentConfig as unknown as Record<string, number>)[paramName];

      const currentWins = closedTrades.filter((t) => (t.pnl ?? 0) > 0).length;
      const currentWinRate = (currentWins / closedTrades.length) * PERCENTAGE_MULTIPLIER;
      const currentPnL = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

      // --- Simulate with modified parameter ---
      let simulatedTrades = [...closedTrades];

      if (paramName === 'minConfidence') {
        // Remove trades whose signal confidence falls below the new threshold
        simulatedTrades = closedTrades.filter((t) => t.signal.confidence >= newValue);
      } else if (paramName === 'defaultPositionPct') {
        // Rescale PnL proportionally to the new position size
        const scaleFactor = newValue / currentConfig.defaultPositionPct;
        simulatedTrades = closedTrades.map((t) => ({
          ...t,
          pnl: (t.pnl ?? 0) * scaleFactor,
        }));
      } else if (paramName === 'maxOpenPositions') {
        // Simplified: keep all trades (position limit affects future intake, not past trades)
        simulatedTrades = [...closedTrades];
      }

      const simWins = simulatedTrades.filter((t) => (t.pnl ?? 0) > 0).length;
      const simWinRate =
        simulatedTrades.length > 0
          ? (simWins / simulatedTrades.length) * PERCENTAGE_MULTIPLIER
          : 0;
      const simPnL = simulatedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

      const winRateDelta = simWinRate - currentWinRate;
      const pnlDelta = simPnL - currentPnL;
      const tradesFiltered = closedTrades.length - simulatedTrades.length;

      const summary =
        `What-if: ${paramName} ${currentValue} -> ${newValue}\n\n` +
        `Current (${closedTrades.length} trades):\n` +
        `  Win rate: ${currentWinRate.toFixed(1)}% | PnL: ${formatPnlSign(currentPnL)}$${currentPnL.toFixed(2)}\n\n` +
        `Simulated (${simulatedTrades.length} trades):\n` +
        `  Win rate: ${simWinRate.toFixed(1)}% | PnL: ${formatPnlSign(simPnL)}$${simPnL.toFixed(2)}\n\n` +
        `Delta: ${formatPnlSign(winRateDelta)}${winRateDelta.toFixed(1)}% win rate | ` +
        `${formatPnlSign(pnlDelta)}$${pnlDelta.toFixed(2)} PnL\n` +
        `Trades filtered: ${tradesFiltered}`;

      if (callback) {
        await callback({
          text: summary,
          source: message.content.source,
          actions: ['WHAT_IF_BACKTEST'],
        });
      }

      return {
        success: true,
        text: summary,
        values: {
          paramName,
          currentValue,
          newValue,
          currentWinRate: currentWinRate.toFixed(1),
          simWinRate: simWinRate.toFixed(1),
          currentPnL: currentPnL.toFixed(2),
          simPnL: simPnL.toFixed(2),
          tradesFiltered,
        },
        data: { actionName: 'WHAT_IF_BACKTEST', paramName, currentValue, newValue },
      };
    } catch (error) {
      const errMsg = `What-if simulation failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error({ error }, 'WHAT_IF_BACKTEST handler error');
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
        content: { text: 'What if we lowered confidence to 55?' },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'What-if: minConfidence 60 -> 55\n\nCurrent (12 trades):\n  Win rate: 66.7% | PnL: +$47.23\n\nSimulated (15 trades):\n  Win rate: 60.0% | PnL: +$38.10\n\nDelta: -6.7% win rate | -$9.13 PnL\nTrades filtered: -3',
          actions: ['WHAT_IF_BACKTEST'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: { text: 'Backtest with position size 10' },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'What-if: defaultPositionPct 5 -> 10\n\nCurrent (8 trades):\n  Win rate: 75.0% | PnL: +$32.50\n\nSimulated (8 trades):\n  Win rate: 75.0% | PnL: +$65.00\n\nDelta: +0.0% win rate | +$32.50 PnL\nTrades filtered: 0',
          actions: ['WHAT_IF_BACKTEST'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: { text: 'Simulate max positions 3' },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'What-if: maxOpenPositions 5 -> 3\n\nCurrent (10 trades):\n  Win rate: 60.0% | PnL: +$18.40\n\nSimulated (10 trades):\n  Win rate: 60.0% | PnL: +$18.40\n\nDelta: +0.0% win rate | +$0.00 PnL\nTrades filtered: 0',
          actions: ['WHAT_IF_BACKTEST'],
        },
      },
    ],
  ],
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

  services: [SignalPollerService, PositionMonitorService, VolumeWatcherService],
  actions: [executeTrade, closeTrade, reviewPerformance, whatIfBacktest],
  providers: [signalProvider, portfolioProvider, agentMemoryProvider],
  evaluators: [tradeEvaluator],
};

export default tradingCallerPlugin;
