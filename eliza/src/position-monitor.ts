/**
 * Real-Time Position Monitor Service
 *
 * Checks open position prices every 60 seconds via Jupiter Price API v2.
 * Automatically closes positions that hit stop-loss or take-profit levels.
 * Reuses the same PnL / cool-off logic from the closeTrade action handler.
 */

import { Service, type IAgentRuntime, logger } from '@elizaos/core';
import type { TradeRecord, StrategyConfig } from './types.ts';
import { DEFAULT_STRATEGY_CONFIG } from './types.ts';
import {
  storeGet,
  storeSet,
  KEY_OPEN_TRADES,
  KEY_TRADE_JOURNAL,
  KEY_COOL_OFF_UNTIL,
  KEY_STRATEGY_CONFIG,
  KEY_PENDING_REVIEW,
} from './trade-store.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POSITION_CHECK_INTERVAL_MS = 60_000; // 1 minute
const JUPITER_PRICE_API = 'https://api.jup.ag/price/v2';

// ---------------------------------------------------------------------------
// Jupiter Price Fetch
// ---------------------------------------------------------------------------

interface JupiterPriceResponse {
  data: Record<string, { id: string; price: string } | undefined>;
}

/**
 * Fetch current USD prices for one or more token addresses in a single call.
 * Returns a map of address -> price. Missing / errored tokens are omitted.
 */
async function fetchPrices(
  tokenAddresses: string[]
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  if (tokenAddresses.length === 0) return prices;

  try {
    const ids = tokenAddresses.join(',');
    const res = await fetch(`${JUPITER_PRICE_API}?ids=${ids}`);
    if (!res.ok) {
      logger.warn(
        { status: res.status },
        'PositionMonitor: Jupiter price API returned non-OK status'
      );
      return prices;
    }

    const json: JupiterPriceResponse = await res.json();
    for (const address of tokenAddresses) {
      const entry = json.data?.[address];
      if (entry?.price) {
        const parsed = parseFloat(entry.price);
        if (!isNaN(parsed)) {
          prices.set(address, parsed);
        }
      }
    }
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'PositionMonitor: failed to fetch prices from Jupiter'
    );
  }

  return prices;
}

// ---------------------------------------------------------------------------
// Close helpers (mirrors closeTrade action handler in plugin.ts)
// ---------------------------------------------------------------------------

function determineCloseStatus(
  trade: TradeRecord,
  currentPrice: number
): TradeRecord['status'] {
  const isLong = trade.signal.action === 'LONG';
  const { stopLoss, targets } = trade.signal;

  if (isLong) {
    if (currentPrice <= stopLoss) return 'stopped_out';
    if (currentPrice >= targets[0]) return 'tp1_hit';
  } else {
    if (currentPrice >= stopLoss) return 'stopped_out';
    if (currentPrice <= targets[0]) return 'tp1_hit';
  }

  // Should not reach here when called only after a trigger condition
  return 'closed';
}

function calculatePnl(
  trade: TradeRecord,
  exitPrice: number
): { pnl: number; pnlPercent: number } {
  const pnl =
    trade.signal.action === 'LONG'
      ? (exitPrice - trade.entryPrice) * trade.positionSizeTokens
      : (trade.entryPrice - exitPrice) * trade.positionSizeTokens;
  const pnlPercent = (pnl / trade.positionSizeUSD) * 100;
  return { pnl, pnlPercent };
}

function shouldTriggerClose(
  trade: TradeRecord,
  currentPrice: number
): boolean {
  const { stopLoss, targets } = trade.signal;

  if (trade.signal.action === 'LONG') {
    return currentPrice <= stopLoss || currentPrice >= targets[0];
  }
  // SHORT
  return currentPrice >= stopLoss || currentPrice <= targets[0];
}

/**
 * Check journal for consecutive losses and activate cool-off if threshold met.
 * Mirrors the consecutive-loss logic in closeTrade handler.
 */
function checkAndApplyCoolOff(): boolean {
  const journal: TradeRecord[] =
    storeGet<TradeRecord[]>(KEY_TRADE_JOURNAL) ?? [];
  const closedTrades = journal.filter((t) => t.status !== 'open').slice(-10);

  let consecutiveLosses = 0;
  for (let i = closedTrades.length - 1; i >= 0; i--) {
    if ((closedTrades[i].pnl ?? 0) < 0) consecutiveLosses++;
    else break;
  }

  const config: StrategyConfig =
    storeGet<StrategyConfig>(KEY_STRATEGY_CONFIG) ?? {
      ...DEFAULT_STRATEGY_CONFIG,
    };

  if (consecutiveLosses >= config.coolOffAfterConsecutiveLosses) {
    const coolOffUntil = Date.now() + config.coolOffDurationMs;
    storeSet(KEY_COOL_OFF_UNTIL, coolOffUntil);
    logger.info(
      { consecutiveLosses, coolOffUntil },
      'PositionMonitor: cool-off activated after consecutive losses'
    );
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// PositionMonitorService
// ---------------------------------------------------------------------------

export class PositionMonitorService extends Service {
  static serviceType = 'position-monitor';
  capabilityDescription =
    'Monitors open positions every 60 seconds and auto-closes on stop-loss or take-profit hits.';

  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  static async start(
    runtime: IAgentRuntime
  ): Promise<PositionMonitorService> {
    logger.info('Starting PositionMonitorService');
    const service = new PositionMonitorService(runtime);
    service.beginChecking();
    return service;
  }

  static async stop(runtime: IAgentRuntime): Promise<void> {
    logger.info('Stopping PositionMonitorService (static)');
    const service = runtime.getService<PositionMonitorService>(
      PositionMonitorService.serviceType
    );
    if (service) {
      await service.stop();
    }
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('PositionMonitorService stopped');
  }

  private beginChecking(): void {
    logger.info(
      { intervalMs: POSITION_CHECK_INTERVAL_MS },
      'PositionMonitorService: check loop started'
    );
    // Run first check immediately, then on interval
    void this.checkPositions();
    this.intervalId = setInterval(
      () => void this.checkPositions(),
      POSITION_CHECK_INTERVAL_MS
    );
  }

  private async checkPositions(): Promise<void> {
    try {
      const openTrades: TradeRecord[] =
        storeGet<TradeRecord[]>(KEY_OPEN_TRADES) ?? [];

      if (openTrades.length === 0) return;

      // Batch-fetch prices for all open positions
      const tokenAddresses = [
        ...new Set(openTrades.map((t) => t.signal.token.address)),
      ];
      const prices = await fetchPrices(tokenAddresses);

      if (prices.size === 0) {
        logger.warn(
          'PositionMonitor: no prices returned, skipping this cycle'
        );
        return;
      }

      const tradesToClose: Array<{
        index: number;
        currentPrice: number;
      }> = [];

      // Identify positions that need closing (iterate in reverse for safe splice)
      for (let i = openTrades.length - 1; i >= 0; i--) {
        const trade = openTrades[i];
        const currentPrice = prices.get(trade.signal.token.address);
        if (currentPrice === undefined) continue;

        if (shouldTriggerClose(trade, currentPrice)) {
          tradesToClose.push({ index: i, currentPrice });
        }
      }

      if (tradesToClose.length === 0) return;

      // Load journal once for all closes
      const journal: TradeRecord[] =
        storeGet<TradeRecord[]>(KEY_TRADE_JOURNAL) ?? [];

      for (const { index, currentPrice } of tradesToClose) {
        const trade = openTrades[index];
        const status = determineCloseStatus(trade, currentPrice);
        const { pnl, pnlPercent } = calculatePnl(trade, currentPrice);

        // Update trade record
        trade.exitPrice = currentPrice;
        trade.pnl = pnl;
        trade.pnlPercent = pnlPercent;
        trade.status = status;
        trade.exitTimestamp = Date.now();

        // Remove from open trades
        openTrades.splice(index, 1);

        // Update journal entry
        const journalIndex = journal.findIndex((t) => t.id === trade.id);
        if (journalIndex !== -1) {
          journal[journalIndex] = trade;
        }

        const outcome = pnl >= 0 ? 'WIN' : 'LOSS';
        const pnlSign = pnl >= 0 ? '+' : '';
        logger.info(
          {
            tradeId: trade.id,
            token: trade.signal.token.symbol,
            action: trade.signal.action,
            entryPrice: trade.entryPrice,
            exitPrice: currentPrice,
            pnl: `${pnlSign}${pnl.toFixed(2)}`,
            pnlPercent: `${pnlSign}${pnlPercent.toFixed(1)}%`,
            status,
          },
          `PositionMonitor: auto-closed [${outcome}] ${trade.signal.action} ${trade.signal.token.symbol}`
        );
      }

      // Persist updated state
      storeSet(KEY_OPEN_TRADES, openTrades);
      storeSet(KEY_TRADE_JOURNAL, journal);

      // Flag evaluator for strategy review
      storeSet(KEY_PENDING_REVIEW, true);

      // Check consecutive losses for cool-off
      checkAndApplyCoolOff();
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'PositionMonitor: checkPositions error'
      );
    }
  }
}
