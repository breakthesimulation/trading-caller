/**
 * Social broadcast module — formats trade events into tweets and posts
 * them via the ElizaOS Twitter plugin.
 *
 * All broadcast functions are fire-and-forget. A broadcast failure must
 * never block or disrupt trade execution.
 */

import { type IAgentRuntime, logger } from '@elizaos/core';
import type { TradingSignal, TradeRecord } from './types.ts';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BROADCAST_ENABLED = process.env.BROADCAST_TRADES === 'true';
const TWITTER_SERVICE_TYPE = 'twitter';
const MAX_TWEET_LENGTH = 280;

// ---------------------------------------------------------------------------
// Portfolio stats (minimal struct for tweet formatting)
// ---------------------------------------------------------------------------

export interface PortfolioStats {
  totalPnL: number;
  winRate: number;
}

/**
 * Compute running PnL and win rate from the trade journal.
 * Only considers closed trades (status !== 'open').
 */
export function computePortfolioStats(journal: TradeRecord[]): PortfolioStats {
  const closed = journal.filter((t) => t.status !== 'open');
  const totalPnL = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0).length;
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;
  return { totalPnL, winRate };
}

// ---------------------------------------------------------------------------
// Tweet formatters
// ---------------------------------------------------------------------------

/** Format the human-readable duration between two timestamps. */
function formatDuration(startMs: number, endMs: number): string {
  const totalMinutes = Math.floor((endMs - startMs) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Build a tweet for a newly opened trade.
 *
 * Example:
 * LONG SOL @ $148.50 | Confidence: 85
 * SL: $142.00 | TP: $155.00 / $162.00 / $170.00
 * 4 confluence factors. Volume 2.1x avg.
 * Sized at 8% ($80). Mode: paper.
 */
export function formatTradeOpenedTweet(signal: TradingSignal, trade: TradeRecord): string {
  const positionPct = ((trade.positionSizeUSD / 1000) * 100).toFixed(0);
  const lines = [
    `${signal.action} ${signal.token.symbol} @ $${signal.entry.toFixed(2)} | Confidence: ${signal.confidence}`,
    `SL: $${signal.stopLoss.toFixed(2)} | TP: $${signal.targets[0].toFixed(2)} / $${signal.targets[1].toFixed(2)} / $${signal.targets[2].toFixed(2)}`,
    `Sized at ${positionPct}% ($${trade.positionSizeUSD.toFixed(0)}). Mode: ${trade.mode}.`,
  ];
  return lines.join('\n').slice(0, MAX_TWEET_LENGTH);
}

/**
 * Build a tweet for a closed trade.
 *
 * Win example:
 * [green] SOL LONG closed. $148.50 -> $162.00.
 * +$10.80 (+13.5%). Duration: 4h 22m. TP2 hit.
 * Running PnL: +$143.61. Win rate: 64.3%.
 *
 * Loss example:
 * [red] WIF LONG stopped. $2.32 -> $2.22.
 * -$5.00 (-4.3%). Duration: 1h 47m.
 * Stop executed as designed.
 */
export function formatTradeClosedTweet(trade: TradeRecord, stats: PortfolioStats): string {
  const pnl = trade.pnl ?? 0;
  const pnlPct = trade.pnlPercent ?? 0;
  const isWin = pnl >= 0;
  const icon = isWin ? '\uD83D\uDFE2' : '\uD83D\uDD34'; // green/red circle
  const pnlSign = isWin ? '+' : '';

  const action = trade.signal.action;
  const symbol = trade.signal.token.symbol;
  const verb = trade.status === 'stopped_out' ? 'stopped' : 'closed';

  const duration =
    trade.exitTimestamp && trade.entryTimestamp
      ? formatDuration(trade.entryTimestamp, trade.exitTimestamp)
      : 'N/A';

  const statusLabel = formatStatusLabel(trade.status);
  const totalPnLSign = stats.totalPnL >= 0 ? '+' : '';

  const lines = [
    `${icon} ${symbol} ${action} ${verb}. $${trade.entryPrice.toFixed(2)} -> $${(trade.exitPrice ?? trade.entryPrice).toFixed(2)}.`,
    `${pnlSign}$${pnl.toFixed(2)} (${pnlSign}${pnlPct.toFixed(1)}%). Duration: ${duration}.${statusLabel ? ` ${statusLabel}.` : ''}`,
    `Running PnL: ${totalPnLSign}$${stats.totalPnL.toFixed(2)}. Win rate: ${stats.winRate.toFixed(1)}%.`,
  ];

  return lines.join('\n').slice(0, MAX_TWEET_LENGTH);
}

/** Map trade status to a human-readable label for tweets. */
function formatStatusLabel(status: TradeRecord['status']): string {
  switch (status) {
    case 'tp1_hit': return 'TP1 hit';
    case 'tp2_hit': return 'TP2 hit';
    case 'tp3_hit': return 'TP3 hit';
    case 'stopped_out': return 'Stop executed as designed';
    default: return '';
  }
}

// ---------------------------------------------------------------------------
// Twitter posting via ElizaOS runtime
// ---------------------------------------------------------------------------

/**
 * Send a tweet through the ElizaOS Twitter service.
 * Returns true on success, false on failure. Never throws.
 */
async function postTweet(runtime: IAgentRuntime, text: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const twitterService = runtime.getService(TWITTER_SERVICE_TYPE) as any;
    if (!twitterService?.twitterClient?.client?.twitterClient) {
      logger.warn('social-broadcast: Twitter service or client not available');
      return false;
    }

    const result = await twitterService.twitterClient.client.twitterClient.sendTweet(text);
    if (result?.data) {
      logger.info({ text: text.slice(0, 60) }, 'social-broadcast: tweet posted');
      return true;
    }

    logger.warn('social-broadcast: sendTweet returned no data');
    return false;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'social-broadcast: failed to post tweet',
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public broadcast API
// ---------------------------------------------------------------------------

/**
 * Broadcast a newly opened trade to Twitter.
 * Fire-and-forget — never throws.
 */
export async function broadcastTradeOpened(
  runtime: IAgentRuntime,
  signal: TradingSignal,
  trade: TradeRecord,
): Promise<void> {
  if (!BROADCAST_ENABLED) return;

  try {
    const tweet = formatTradeOpenedTweet(signal, trade);
    await postTweet(runtime, tweet);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'social-broadcast: broadcastTradeOpened failed',
    );
  }
}

/**
 * Broadcast a closed trade to Twitter with running portfolio stats.
 * Fire-and-forget — never throws.
 */
export async function broadcastTradeClosed(
  runtime: IAgentRuntime,
  trade: TradeRecord,
  stats: PortfolioStats,
): Promise<void> {
  if (!BROADCAST_ENABLED) return;

  try {
    const tweet = formatTradeClosedTweet(trade, stats);
    await postTweet(runtime, tweet);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'social-broadcast: broadcastTradeClosed failed',
    );
  }
}
