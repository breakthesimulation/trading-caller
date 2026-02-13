/**
 * Performance Storage Module
 * 
 * JSON file-based storage for signal performance tracking.
 * Railway-compatible (no native modules needed).
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import type { 
  TrackedSignal, 
  SignalStatus, 
  SignalPerformanceStats, 
  TokenPerformanceStats,
  DirectionalStats 
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure data directory exists
const dataDir = join(__dirname, '..', 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// ============ JSON Storage Helpers ============

function loadJson<T>(filename: string, defaultValue: T): T {
  const filepath = join(dataDir, filename);
  try {
    if (existsSync(filepath)) {
      return JSON.parse(readFileSync(filepath, 'utf-8'));
    }
  } catch (e) {
    console.warn(`[PerfStorage] Failed to load ${filename}:`, e);
  }
  return defaultValue;
}

function saveJson(filename: string, data: any): void {
  const filepath = join(dataDir, filename);
  try {
    writeFileSync(filepath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn(`[PerfStorage] Failed to save ${filename}:`, e);
  }
}

// ============ Data Store ============

// In-memory store, persisted to JSON
// Start fresh on every deploy — old resolved signals with stale PnL are discarded
let signals: TrackedSignal[] = [];
saveJson('tracked_signals.json', signals);

// Save with debounce to avoid excessive writes
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
function debouncedSave(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveJson('tracked_signals.json', signals);
    saveTimeout = null;
  }, 1000);
}

// Force immediate save
function forceSave(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveJson('tracked_signals.json', signals);
  saveTimeout = null;
}

// ============ Signal CRUD ============

/**
 * Create a new tracked signal
 */
export function createSignal(signal: Omit<TrackedSignal, 'status' | 'createdAt' | 'expiresAt' | 'checkCount'>): TrackedSignal {
  // Calculate expiration (48 hours from creation)
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  
  const tracked: TrackedSignal = {
    ...signal,
    status: 'ACTIVE',
    createdAt,
    expiresAt,
    checkCount: 0,
  };
  
  // Check if signal already exists (avoid duplicates)
  const existing = signals.find(s => s.id === signal.id);
  if (existing) {
    console.log(`[PerfStorage] Signal ${signal.id} already exists, skipping`);
    return existing;
  }
  
  signals.push(tracked);
  debouncedSave();
  
  console.log(`[PerfStorage] Created signal ${signal.id} for ${signal.tokenSymbol}`);
  return tracked;
}

/**
 * Get a signal by ID
 */
export function getSignal(id: string): TrackedSignal | null {
  return signals.find(s => s.id === id) || null;
}

/**
 * Get all active signals (need monitoring)
 */
export function getActiveSignals(): TrackedSignal[] {
  return signals.filter(s => s.status === 'ACTIVE');
}

/**
 * Get all signals (with optional filters)
 */
export function getAllSignals(options?: {
  status?: SignalStatus | SignalStatus[];
  token?: string;
  action?: 'LONG' | 'SHORT';
  limit?: number;
  offset?: number;
}): TrackedSignal[] {
  let filtered = [...signals];
  
  if (options?.status) {
    const statuses = Array.isArray(options.status) ? options.status : [options.status];
    filtered = filtered.filter(s => statuses.includes(s.status));
  }
  
  if (options?.token) {
    filtered = filtered.filter(s => 
      s.tokenSymbol.toLowerCase() === options.token!.toLowerCase()
    );
  }
  
  if (options?.action) {
    filtered = filtered.filter(s => s.action === options.action);
  }
  
  // Sort by creation date (newest first)
  filtered.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  if (options?.offset) {
    filtered = filtered.slice(options.offset);
  }
  
  if (options?.limit) {
    filtered = filtered.slice(0, options.limit);
  }
  
  return filtered;
}

/**
 * Update a signal's status and data
 */
export function updateSignal(
  id: string, 
  updates: Partial<Pick<TrackedSignal, 
    'status' | 'exitPrice' | 'pnlPercent' | 'highestPnl' | 'lowestPnl' |
    'resolvedAt' | 'lastCheckedAt' | 'checkCount' |
    'tp1HitAt' | 'tp2HitAt' | 'tp3HitAt' | 'stopHitAt'
  >>
): TrackedSignal | null {
  const signal = signals.find(s => s.id === id);
  if (!signal) return null;
  
  Object.assign(signal, updates);
  debouncedSave();
  
  return signal;
}

/**
 * Mark a signal as resolved (final state)
 */
export function resolveSignal(
  id: string,
  status: SignalStatus,
  exitPrice: number,
  pnlPercent: number
): TrackedSignal | null {
  const signal = signals.find(s => s.id === id);
  if (!signal) return null;
  
  signal.status = status;
  signal.exitPrice = exitPrice;
  signal.pnlPercent = pnlPercent;
  signal.resolvedAt = new Date().toISOString();
  
  // Set appropriate timestamp based on status
  const now = new Date().toISOString();
  switch (status) {
    case 'TP1_HIT':
      if (!signal.tp1HitAt) signal.tp1HitAt = now;
      break;
    case 'TP2_HIT':
      if (!signal.tp1HitAt) signal.tp1HitAt = now;
      if (!signal.tp2HitAt) signal.tp2HitAt = now;
      break;
    case 'TP3_HIT':
      if (!signal.tp1HitAt) signal.tp1HitAt = now;
      if (!signal.tp2HitAt) signal.tp2HitAt = now;
      if (!signal.tp3HitAt) signal.tp3HitAt = now;
      break;
    case 'STOPPED_OUT':
      signal.stopHitAt = now;
      break;
  }
  
  forceSave(); // Immediate save for resolved signals
  
  console.log(`[PerfStorage] Resolved signal ${id}: ${status} @ ${exitPrice} (${pnlPercent.toFixed(2)}%)`);
  return signal;
}

// ============ Statistics ============

/**
 * Get overall performance statistics
 */
export function getPerformanceStats(): SignalPerformanceStats {
  const total = signals.length;
  const active = signals.filter(s => s.status === 'ACTIVE').length;
  
  // Count outcomes
  const tp1Hits = signals.filter(s => ['TP1_HIT', 'TP2_HIT', 'TP3_HIT'].includes(s.status)).length;
  const tp2Hits = signals.filter(s => ['TP2_HIT', 'TP3_HIT'].includes(s.status)).length;
  const tp3Hits = signals.filter(s => s.status === 'TP3_HIT').length;
  const stoppedOut = signals.filter(s => s.status === 'STOPPED_OUT').length;
  const expired = signals.filter(s => s.status === 'EXPIRED').length;
  const invalidated = signals.filter(s => s.status === 'INVALIDATED').length;
  
  // Calculate rates
  const resolved = total - active - invalidated;
  const wins = tp1Hits;
  const losses = stoppedOut + expired;
  
  const winRate = resolved > 0 ? (wins / resolved) * 100 : 0;
  const fullWinRate = resolved > 0 ? (tp3Hits / resolved) * 100 : 0;
  const lossRate = resolved > 0 ? (losses / resolved) * 100 : 0;
  
  // Calculate PnL metrics (filter out infinite values)
  const resolvedSignals = signals.filter(s => 
    s.status !== 'ACTIVE' && 
    s.status !== 'INVALIDATED' && 
    s.pnlPercent !== undefined &&
    isFinite(s.pnlPercent)
  );
  
  const winningSignals = resolvedSignals.filter(s => 
    ['TP1_HIT', 'TP2_HIT', 'TP3_HIT'].includes(s.status)
  );
  const losingSignals = resolvedSignals.filter(s => 
    ['STOPPED_OUT', 'EXPIRED'].includes(s.status)
  );
  
  const totalPnl = resolvedSignals.reduce((sum, s) => sum + (s.pnlPercent || 0), 0);
  const avgPnl = resolvedSignals.length > 0 ? totalPnl / resolvedSignals.length : 0;
  
  const avgWinPnl = winningSignals.length > 0
    ? winningSignals.reduce((sum, s) => sum + (s.pnlPercent || 0), 0) / winningSignals.length
    : 0;
  
  const avgLossPnl = losingSignals.length > 0
    ? losingSignals.reduce((sum, s) => sum + (s.pnlPercent || 0), 0) / losingSignals.length
    : 0;
  
  const grossProfit = winningSignals.reduce((sum, s) => sum + Math.max(0, s.pnlPercent || 0), 0);
  const grossLoss = Math.abs(losingSignals.reduce((sum, s) => sum + Math.min(0, s.pnlPercent || 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  
  // Time metrics
  const tp1WithTime = signals.filter(s => s.tp1HitAt && s.createdAt);
  const avgTimeToTP1Hours = tp1WithTime.length > 0
    ? tp1WithTime.reduce((sum, s) => {
        const diff = new Date(s.tp1HitAt!).getTime() - new Date(s.createdAt).getTime();
        return sum + diff / (1000 * 60 * 60);
      }, 0) / tp1WithTime.length
    : 0;
  
  const stopWithTime = signals.filter(s => s.stopHitAt && s.createdAt);
  const avgTimeToStopHours = stopWithTime.length > 0
    ? stopWithTime.reduce((sum, s) => {
        const diff = new Date(s.stopHitAt!).getTime() - new Date(s.createdAt).getTime();
        return sum + diff / (1000 * 60 * 60);
      }, 0) / stopWithTime.length
    : 0;
  
  // Directional stats
  const longStats = getDirectionalStats('LONG');
  const shortStats = getDirectionalStats('SHORT');
  
  return {
    total,
    active,
    tp1Hits,
    tp2Hits,
    tp3Hits,
    stoppedOut,
    expired,
    invalidated,
    winRate,
    fullWinRate,
    lossRate,
    avgPnl,
    avgWinPnl,
    avgLossPnl,
    totalPnl,
    profitFactor,
    avgTimeToTP1Hours,
    avgTimeToStopHours,
    longStats,
    shortStats,
  };
}

function getDirectionalStats(action: 'LONG' | 'SHORT'): DirectionalStats {
  const dirSignals = signals.filter(s => s.action === action);
  const total = dirSignals.length;
  
  const wins = dirSignals.filter(s => 
    ['TP1_HIT', 'TP2_HIT', 'TP3_HIT'].includes(s.status)
  ).length;
  
  const losses = dirSignals.filter(s => 
    ['STOPPED_OUT', 'EXPIRED'].includes(s.status)
  ).length;
  
  const resolved = total - dirSignals.filter(s => s.status === 'ACTIVE').length;
  const winRate = resolved > 0 ? (wins / resolved) * 100 : 0;
  
  const withPnl = dirSignals.filter(s => s.pnlPercent !== undefined);
  const avgPnl = withPnl.length > 0
    ? withPnl.reduce((sum, s) => sum + (s.pnlPercent || 0), 0) / withPnl.length
    : 0;
  
  return { total, wins, losses, winRate, avgPnl };
}

/**
 * Get performance stats by token
 */
export function getTokenPerformanceStats(): TokenPerformanceStats[] {
  // Group signals by token
  const byToken = new Map<string, TrackedSignal[]>();
  
  for (const signal of signals) {
    const existing = byToken.get(signal.tokenSymbol) || [];
    existing.push(signal);
    byToken.set(signal.tokenSymbol, existing);
  }
  
  // Calculate stats for each token
  const stats: TokenPerformanceStats[] = [];
  
  for (const [symbol, tokenSignals] of byToken) {
    const total = tokenSignals.length;
    
    const tp1Hits = tokenSignals.filter(s => 
      ['TP1_HIT', 'TP2_HIT', 'TP3_HIT'].includes(s.status)
    ).length;
    const tp2Hits = tokenSignals.filter(s => 
      ['TP2_HIT', 'TP3_HIT'].includes(s.status)
    ).length;
    const tp3Hits = tokenSignals.filter(s => s.status === 'TP3_HIT').length;
    const stoppedOut = tokenSignals.filter(s => s.status === 'STOPPED_OUT').length;
    const expired = tokenSignals.filter(s => s.status === 'EXPIRED').length;
    
    const resolved = tokenSignals.filter(s => s.status !== 'ACTIVE').length;
    const winRate = resolved > 0 ? (tp1Hits / resolved) * 100 : 0;
    
    const withPnl = tokenSignals.filter(s => s.pnlPercent !== undefined);
    const totalPnl = withPnl.reduce((sum, s) => sum + (s.pnlPercent || 0), 0);
    const avgPnl = withPnl.length > 0 ? totalPnl / withPnl.length : 0;
    
    const pnls = withPnl.map(s => s.pnlPercent || 0);
    const bestPnl = pnls.length > 0 ? Math.max(...pnls) : 0;
    const worstPnl = pnls.length > 0 ? Math.min(...pnls) : 0;
    
    // Last 5 signals
    const last5 = tokenSignals
      .filter(s => s.status !== 'ACTIVE')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
    const last5Wins = last5.filter(s => 
      ['TP1_HIT', 'TP2_HIT', 'TP3_HIT'].includes(s.status)
    ).length;
    const last5WinRate = last5.length > 0 ? (last5Wins / last5.length) * 100 : 0;
    
    stats.push({
      tokenSymbol: symbol,
      tokenAddress: tokenSignals[0]?.tokenAddress || '',
      total,
      tp1Hits,
      tp2Hits,
      tp3Hits,
      stoppedOut,
      expired,
      winRate,
      avgPnl,
      totalPnl,
      bestPnl,
      worstPnl,
      last5WinRate,
    });
  }
  
  return stats;
}

/**
 * Get token leaderboard
 */
export function getTokenLeaderboard(): {
  best: TokenPerformanceStats[];
  worst: TokenPerformanceStats[];
  mostActive: TokenPerformanceStats[];
  highestWinRate: TokenPerformanceStats[];
} {
  const stats = getTokenPerformanceStats();
  
  // Filter to tokens with at least 3 resolved signals
  const qualified = stats.filter(s => 
    s.total - (s.tp1Hits + s.stoppedOut + s.expired > 0 ? 0 : s.total) >= 3
  );
  
  const byAvgPnl = [...stats].sort((a, b) => b.avgPnl - a.avgPnl);
  const byWinRate = [...qualified].sort((a, b) => b.winRate - a.winRate);
  const byTotal = [...stats].sort((a, b) => b.total - a.total);
  
  return {
    best: byAvgPnl.slice(0, 5),
    worst: byAvgPnl.slice(-5).reverse(),
    mostActive: byTotal.slice(0, 5),
    highestWinRate: byWinRate.slice(0, 5),
  };
}

// ============ Exports ============

/**
 * Update current price for an active signal and compute PnL
 */
export function updateCurrentPrice(id: string, currentPrice: number): TrackedSignal | null {
  const signal = signals.find(s => s.id === id);
  if (!signal || signal.status !== 'ACTIVE') return null;
  
  signal.currentPrice = currentPrice;
  
  // Calculate P&L
  const entry = signal.entryPrice;
  if (entry && entry > 0) {
    if (signal.action === 'LONG') {
      signal.pnlPercent = ((currentPrice - entry) / entry) * 100;
    } else {
      signal.pnlPercent = ((entry - currentPrice) / entry) * 100;
    }
    
    // Track high/low
    if (!signal.highestPnl || signal.pnlPercent > signal.highestPnl) {
      signal.highestPnl = signal.pnlPercent;
    }
    if (!signal.lowestPnl || signal.pnlPercent < signal.lowestPnl) {
      signal.lowestPnl = signal.pnlPercent;
    }
  }
  
  return signal;
}

/**
 * Reset all tracked signals (clears history)
 */
export function resetAllSignals(): void {
  signals = [];
  forceSave();
  console.log('[PerfStorage] All signals reset');
}

export const storage = {
  createSignal,
  getSignal,
  getActiveSignals,
  getAllSignals,
  updateSignal,
  resolveSignal,
  updateCurrentPrice,
  getPerformanceStats,
  getTokenPerformanceStats,
  getTokenLeaderboard,
  forceSave,
  resetAllSignals,
};

export default storage;
