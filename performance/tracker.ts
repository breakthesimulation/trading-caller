/**
 * Performance Tracker - Active Signal Monitoring
 * 
 * Monitors active signals, checks prices, and detects outcomes:
 * - TP1/TP2/TP3 hits
 * - Stop loss hits
 * - Signal expiration
 */

import { getPrice } from '../research-engine/src/data/jupiter.js';
import { storage } from './storage.js';
import type { TrackedSignal, SignalStatus, PriceCheck } from './types.js';

// Track consecutive API failures per token (for backoff)
const apiFailures = new Map<string, number>();
const MAX_FAILURES = 5;
const FAILURE_RESET_INTERVAL = 30 * 60 * 1000; // 30 minutes

// Periodically reset failure counts
setInterval(() => {
  apiFailures.clear();
}, FAILURE_RESET_INTERVAL);

/**
 * Record a new signal for tracking
 */
export function trackSignal(signal: {
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
}): TrackedSignal | null {
  // Validate entry price - reject invalid signals
  if (!signal.entry || signal.entry <= 0 || !isFinite(signal.entry)) {
    console.log(`[Tracker] Rejecting signal ${signal.id} for ${signal.token.symbol}: invalid entry price ${signal.entry}`);
    return null;
  }
  
  // Ensure we have 3 targets (pad with reasonable estimates if needed)
  const targets = [...signal.targets];
  while (targets.length < 3) {
    const lastTarget = targets[targets.length - 1] || signal.entry;
    const riskAmount = Math.abs(signal.entry - signal.stopLoss);
    const nextTarget = signal.action === 'LONG'
      ? lastTarget + riskAmount
      : lastTarget - riskAmount;
    targets.push(nextTarget);
  }

  return storage.createSignal({
    id: signal.id,
    tokenSymbol: signal.token.symbol,
    tokenAddress: signal.token.address,
    action: signal.action,
    entryPrice: signal.entry,
    tp1: targets[0],
    tp2: targets[1],
    tp3: targets[2],
    stopLoss: signal.stopLoss,
    confidence: signal.confidence,
    timeframe: signal.timeframe,
    reasoning: signal.reasoning,
    indicators: signal.indicators,
  });
}

/**
 * Calculate PnL percentage for a given price
 */
function calculatePnl(
  action: 'LONG' | 'SHORT',
  entryPrice: number,
  currentPrice: number
): number {
  // Handle edge case of 0 entry price
  if (entryPrice === 0 || !isFinite(entryPrice)) {
    return 0;
  }
  
  if (action === 'LONG') {
    return ((currentPrice - entryPrice) / entryPrice) * 100;
  } else {
    return ((entryPrice - currentPrice) / entryPrice) * 100;
  }
}

/**
 * Check if a target level was hit
 */
function checkTargetHit(
  action: 'LONG' | 'SHORT',
  currentPrice: number,
  targetPrice: number
): boolean {
  if (action === 'LONG') {
    return currentPrice >= targetPrice;
  } else {
    return currentPrice <= targetPrice;
  }
}

/**
 * Check if stop loss was hit
 */
function checkStopHit(
  action: 'LONG' | 'SHORT',
  currentPrice: number,
  stopLoss: number
): boolean {
  if (action === 'LONG') {
    return currentPrice <= stopLoss;
  } else {
    return currentPrice >= stopLoss;
  }
}

/**
 * Determine the outcome status based on current price
 */
function determineOutcome(
  signal: TrackedSignal,
  currentPrice: number
): { status: SignalStatus; pnl: number } {
  const pnl = calculatePnl(signal.action, signal.entryPrice, currentPrice);
  
  // Check stop loss first (takes priority)
  if (checkStopHit(signal.action, currentPrice, signal.stopLoss)) {
    return { status: 'STOPPED_OUT', pnl };
  }
  
  // Check targets in order (TP3 > TP2 > TP1)
  if (checkTargetHit(signal.action, currentPrice, signal.tp3)) {
    return { status: 'TP3_HIT', pnl };
  }
  if (checkTargetHit(signal.action, currentPrice, signal.tp2)) {
    return { status: 'TP2_HIT', pnl };
  }
  if (checkTargetHit(signal.action, currentPrice, signal.tp1)) {
    return { status: 'TP1_HIT', pnl };
  }
  
  // Still active
  return { status: 'ACTIVE', pnl };
}

/**
 * Check a single signal's price and update status
 */
export async function checkSignal(signal: TrackedSignal): Promise<PriceCheck | null> {
  const tokenKey = signal.tokenSymbol;
  
  // Skip if too many recent failures for this token
  const failures = apiFailures.get(tokenKey) || 0;
  if (failures >= MAX_FAILURES) {
    console.log(`[Tracker] Skipping ${tokenKey} due to ${failures} recent API failures`);
    return null;
  }
  
  try {
    const currentPrice = await getPrice(signal.tokenAddress);
    
    if (!currentPrice) {
      apiFailures.set(tokenKey, failures + 1);
      console.log(`[Tracker] Could not get price for ${signal.tokenSymbol}`);
      return null;
    }
    
    // Reset failure count on success
    apiFailures.set(tokenKey, 0);
    
    const { status, pnl } = determineOutcome(signal, currentPrice);
    const now = new Date().toISOString();
    
    // Update highest/lowest PnL
    const highestPnl = Math.max(signal.highestPnl || pnl, pnl);
    const lowestPnl = Math.min(signal.lowestPnl || pnl, pnl);
    
    // Update signal tracking data
    storage.updateSignal(signal.id, {
      lastCheckedAt: now,
      checkCount: signal.checkCount + 1,
      highestPnl,
      lowestPnl,
    });
    
    const result: PriceCheck = {
      signalId: signal.id,
      price: currentPrice,
      pnlPercent: pnl,
      timestamp: now,
    };
    
    // If status changed, resolve the signal
    if (status !== 'ACTIVE') {
      storage.resolveSignal(signal.id, status, currentPrice, pnl);
      result.statusChange = status;
      console.log(`[Tracker] Signal ${signal.id} (${signal.tokenSymbol} ${signal.action}): ${status} at $${currentPrice.toFixed(6)} (${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%)`);
    }
    
    return result;
    
  } catch (error) {
    apiFailures.set(tokenKey, failures + 1);
    console.error(`[Tracker] Error checking ${signal.tokenSymbol}:`, error);
    return null;
  }
}

/**
 * Check for expired signals
 */
export function checkExpiredSignals(): TrackedSignal[] {
  const now = new Date();
  const activeSignals = storage.getActiveSignals();
  const expired: TrackedSignal[] = [];
  
  for (const signal of activeSignals) {
    const expiresAt = new Date(signal.expiresAt);
    
    if (now > expiresAt) {
      // Determine final PnL based on last known data
      // Since we don't have current price, use the best/worst estimates
      const estimatedPnl = signal.highestPnl || signal.lowestPnl || 0;
      
      storage.resolveSignal(signal.id, 'EXPIRED', signal.entryPrice, estimatedPnl);
      expired.push(signal);
      
      console.log(`[Tracker] Signal ${signal.id} (${signal.tokenSymbol}) expired`);
    }
  }
  
  return expired;
}

/**
 * Run a full check cycle on all active signals
 */
export async function runCheckCycle(): Promise<{
  checked: number;
  resolved: number;
  expired: number;
  errors: number;
  results: PriceCheck[];
}> {
  console.log('[Tracker] Starting price check cycle...');
  
  const activeSignals = storage.getActiveSignals();
  const results: PriceCheck[] = [];
  let resolved = 0;
  let errors = 0;
  
  // Check expired first
  const expiredSignals = checkExpiredSignals();
  
  // Check active signals with rate limiting
  for (const signal of activeSignals) {
    try {
      const result = await checkSignal(signal);
      
      if (result) {
        results.push(result);
        if (result.statusChange) {
          resolved++;
        }
      } else {
        errors++;
      }
      
      // Rate limit: 250ms between API calls
      await new Promise(r => setTimeout(r, 250));
      
    } catch (error) {
      errors++;
      console.error(`[Tracker] Error in check cycle for ${signal.tokenSymbol}:`, error);
    }
  }
  
  console.log(`[Tracker] Check cycle complete: ${results.length} checked, ${resolved} resolved, ${expiredSignals.length} expired, ${errors} errors`);
  
  return {
    checked: results.length,
    resolved,
    expired: expiredSignals.length,
    errors,
    results,
  };
}

/**
 * Get signal status (for API endpoint)
 */
export function getSignalStatus(signalId: string): {
  found: boolean;
  signal?: TrackedSignal;
  currentPnl?: number;
  targetsHit?: { tp1: boolean; tp2: boolean; tp3: boolean };
  timeActive?: string;
} {
  const signal = storage.getSignal(signalId);
  
  if (!signal) {
    return { found: false };
  }
  
  // Calculate time active
  const created = new Date(signal.createdAt);
  const now = signal.resolvedAt ? new Date(signal.resolvedAt) : new Date();
  const diffMs = now.getTime() - created.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const timeActive = `${hours}h ${minutes}m`;
  
  // Determine which targets were hit
  const targetsHit = {
    tp1: !!signal.tp1HitAt || ['TP1_HIT', 'TP2_HIT', 'TP3_HIT'].includes(signal.status),
    tp2: !!signal.tp2HitAt || ['TP2_HIT', 'TP3_HIT'].includes(signal.status),
    tp3: !!signal.tp3HitAt || signal.status === 'TP3_HIT',
  };
  
  return {
    found: true,
    signal,
    currentPnl: signal.pnlPercent,
    targetsHit,
    timeActive,
  };
}

/**
 * Get performance summary (for API endpoint)
 */
export function getPerformanceSummary() {
  return storage.getPerformanceStats();
}

/**
 * Get token leaderboard (for API endpoint)
 */
export function getTokenLeaderboard() {
  return storage.getTokenLeaderboard();
}

/**
 * Get all signals with optional filters
 */
export function getSignals(options?: Parameters<typeof storage.getAllSignals>[0]) {
  return storage.getAllSignals(options);
}

// ============ Exports ============

export const performanceTracker = {
  trackSignal,
  checkSignal,
  checkExpiredSignals,
  runCheckCycle,
  getSignalStatus,
  getPerformanceSummary,
  getTokenLeaderboard,
  getSignals,
};

export default performanceTracker;
