/**
 * Outcome Tracker - Track Signal Performance
 * 
 * Stores every signal generated, checks prices after 24h/48h/7d,
 * marks as WIN/LOSS/NEUTRAL, and calculates win rates.
 */

import { db } from '../db/index.js';
import { getPrice } from '../research-engine/src/data/jupiter.js';

interface SignalOutcome {
  callId: string;
  tokenSymbol: string;
  tokenAddress: string;
  action: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  targetPrices: number[];
  stopLoss: number;
  outcome: 'WIN' | 'LOSS' | 'NEUTRAL';
  pnlPercent: number;
  hoursElapsed: number;
}

/**
 * Record a new trading signal/call
 */
export function recordSignal(signal: {
  id: string;
  token: { symbol: string; address: string };
  action: 'LONG' | 'SHORT';
  entry: number;
  targets: number[];
  stopLoss: number;
  confidence: number;
  timeframe: string;
  reasoning?: string;
  indicators?: Record<string, number>;
}): void {
  db.saveCall({
    id: signal.id,
    tokenSymbol: signal.token.symbol,
    tokenAddress: signal.token.address,
    action: signal.action,
    entryPrice: signal.entry,
    targetPrices: signal.targets,
    stopLoss: signal.stopLoss,
    confidence: signal.confidence,
    timeframe: signal.timeframe,
    reasoning: signal.reasoning,
    indicators: signal.indicators,
  });

  console.log(`[Tracker] Recorded signal ${signal.id} for ${signal.token.symbol}`);
}

/**
 * Determine the outcome of a call based on current price
 */
function determineOutcome(
  action: string,
  entryPrice: number,
  currentPrice: number,
  targetPrices: number[],
  stopLoss: number
): { outcome: 'WIN' | 'LOSS' | 'NEUTRAL'; pnlPercent: number } {
  const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
  
  // Adjust for direction
  const adjustedPnl = action === 'SHORT' ? -pnlPercent : pnlPercent;
  
  // Check if stop loss was hit
  if (action === 'LONG' && currentPrice <= stopLoss) {
    return { outcome: 'LOSS', pnlPercent: adjustedPnl };
  }
  if (action === 'SHORT' && currentPrice >= stopLoss) {
    return { outcome: 'LOSS', pnlPercent: adjustedPnl };
  }
  
  // Check if any target was hit
  const firstTarget = targetPrices[0];
  if (action === 'LONG' && currentPrice >= firstTarget) {
    return { outcome: 'WIN', pnlPercent: adjustedPnl };
  }
  if (action === 'SHORT' && currentPrice <= firstTarget) {
    return { outcome: 'WIN', pnlPercent: adjustedPnl };
  }
  
  // Neither target nor stop hit - neutral
  return { outcome: 'NEUTRAL', pnlPercent: adjustedPnl };
}

/**
 * Check outcomes for signals at a specific time window
 */
export async function checkOutcomes(hours: 24 | 48 | 168): Promise<SignalOutcome[]> {
  console.log(`[Tracker] Checking outcomes for ${hours}h window...`);
  
  const calls = db.getCallsForOutcomeCheck(hours);
  const outcomes: SignalOutcome[] = [];
  
  for (const call of calls) {
    try {
      // Get current price
      const currentPrice = await getPrice(call.tokenAddress);
      
      if (!currentPrice) {
        console.log(`[Tracker] Could not get price for ${call.tokenSymbol}`);
        db.markCallChecked(call.id, hours);
        continue;
      }
      
      // Determine outcome
      const { outcome, pnlPercent } = determineOutcome(
        call.action,
        call.entryPrice,
        currentPrice,
        call.targetPrices,
        call.stopLoss
      );
      
      // Only finalize outcome at 7d mark or if clear win/loss
      if (hours === 168 || outcome !== 'NEUTRAL') {
        db.updateCallOutcome(call.id, outcome, currentPrice, pnlPercent);
        
        // Update learning weights
        if (call.indicators) {
          for (const [indicator, value] of Object.entries(call.indicators)) {
            const weightId = `${indicator}_${call.action}`;
            db.updateLearningWeight(
              weightId,
              'indicator',
              outcome === 'WIN',
              pnlPercent
            );
          }
        }
        
        // Token-specific learning
        db.updateLearningWeight(
          `token_${call.tokenSymbol}`,
          'token',
          outcome === 'WIN',
          pnlPercent
        );
        
        console.log(`[Tracker] ${call.tokenSymbol} ${call.action}: ${outcome} (${pnlPercent.toFixed(2)}%)`);
      }
      
      // Mark as checked at this interval
      db.markCallChecked(call.id, hours);
      
      outcomes.push({
        callId: call.id,
        tokenSymbol: call.tokenSymbol,
        tokenAddress: call.tokenAddress,
        action: call.action as 'LONG' | 'SHORT',
        entryPrice: call.entryPrice,
        currentPrice,
        targetPrices: call.targetPrices,
        stopLoss: call.stopLoss,
        outcome,
        pnlPercent,
        hoursElapsed: hours,
      });
      
      // Rate limit
      await new Promise(r => setTimeout(r, 200));
    } catch (error) {
      console.error(`[Tracker] Error checking ${call.tokenSymbol}:`, error);
    }
  }
  
  console.log(`[Tracker] Checked ${outcomes.length} calls at ${hours}h`);
  return outcomes;
}

/**
 * Run full outcome check cycle (24h, 48h, 7d)
 */
export async function runOutcomeCheck(): Promise<{
  checked24h: number;
  checked48h: number;
  checked7d: number;
  wins: number;
  losses: number;
  neutral: number;
}> {
  console.log('[Tracker] Running full outcome check cycle...');
  
  let wins = 0;
  let losses = 0;
  let neutral = 0;
  
  // Check 24h outcomes
  const outcomes24h = await checkOutcomes(24);
  for (const o of outcomes24h) {
    if (o.outcome === 'WIN') wins++;
    else if (o.outcome === 'LOSS') losses++;
    else neutral++;
  }
  
  // Check 48h outcomes
  const outcomes48h = await checkOutcomes(48);
  for (const o of outcomes48h) {
    if (o.outcome === 'WIN') wins++;
    else if (o.outcome === 'LOSS') losses++;
    else neutral++;
  }
  
  // Check 7d outcomes (final)
  const outcomes7d = await checkOutcomes(168);
  for (const o of outcomes7d) {
    if (o.outcome === 'WIN') wins++;
    else if (o.outcome === 'LOSS') losses++;
    else neutral++;
  }
  
  console.log(`[Tracker] Outcome check complete: ${wins} wins, ${losses} losses, ${neutral} neutral`);
  
  return {
    checked24h: outcomes24h.length,
    checked48h: outcomes48h.length,
    checked7d: outcomes7d.length,
    wins,
    losses,
    neutral,
  };
}

/**
 * Get overall performance statistics
 */
export function getPerformanceStats(): {
  total: number;
  wins: number;
  losses: number;
  neutral: number;
  pending: number;
  winRate: number;
  avgPnl: number;
  tokenStats: Array<{
    token: string;
    total: number;
    wins: number;
    losses: number;
    winRate: number;
    avgPnl: number;
  }>;
} {
  const stats = db.getCallStats();
  const tokenStats = db.getTokenStats();
  
  return {
    ...stats,
    tokenStats,
  };
}

/**
 * Get best and worst performing tokens
 */
export function getTokenPerformance(): {
  best: Array<{ token: string; winRate: number; avgPnl: number }>;
  worst: Array<{ token: string; winRate: number; avgPnl: number }>;
} {
  const tokenStats = db.getTokenStats();
  
  const withEnoughData = tokenStats.filter(t => t.wins + t.losses >= 3);
  
  const sorted = [...withEnoughData].sort((a, b) => b.winRate - a.winRate);
  
  return {
    best: sorted.slice(0, 5).map(t => ({
      token: t.token,
      winRate: t.winRate,
      avgPnl: t.avgPnl,
    })),
    worst: sorted.slice(-5).reverse().map(t => ({
      token: t.token,
      winRate: t.winRate,
      avgPnl: t.avgPnl,
    })),
  };
}

export default {
  recordSignal,
  checkOutcomes,
  runOutcomeCheck,
  getPerformanceStats,
  getTokenPerformance,
};
