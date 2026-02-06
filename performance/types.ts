/**
 * Performance Tracking Types
 * 
 * Comprehensive types for signal outcome tracking
 */

export type SignalStatus = 
  | 'ACTIVE'           // Signal is live, monitoring price
  | 'TP1_HIT'          // First target hit (partial win)
  | 'TP2_HIT'          // Second target hit (good win)
  | 'TP3_HIT'          // Third target hit (full win)
  | 'STOPPED_OUT'      // Stop loss hit (loss)
  | 'EXPIRED'          // No target/stop hit within timeframe
  | 'INVALIDATED';     // Signal conditions changed before entry

export interface TrackedSignal {
  id: string;
  tokenSymbol: string;
  tokenAddress: string;
  action: 'LONG' | 'SHORT';
  
  // Price levels
  entryPrice: number;
  tp1: number;           // Target 1 (1.5R typically)
  tp2: number;           // Target 2 (2.5R typically)
  tp3: number;           // Target 3 (4R typically)
  stopLoss: number;
  
  // Tracking metadata
  confidence: number;
  timeframe: string;
  reasoning?: string;
  indicators?: Record<string, number>;
  
  // Status tracking
  status: SignalStatus;
  createdAt: string;
  expiresAt: string;     // When signal expires if no target/stop hit
  
  // Outcome data (filled when resolved)
  resolvedAt?: string;
  exitPrice?: number;
  pnlPercent?: number;
  highestPnl?: number;   // Maximum PnL reached during signal lifetime
  lowestPnl?: number;    // Minimum PnL reached
  
  // Target hit timestamps
  tp1HitAt?: string;
  tp2HitAt?: string;
  tp3HitAt?: string;
  stopHitAt?: string;
  
  // Check tracking
  lastCheckedAt?: string;
  checkCount: number;
}

export interface SignalPerformanceStats {
  total: number;
  active: number;
  
  // Outcomes
  tp1Hits: number;        // Hit at least TP1
  tp2Hits: number;        // Hit at least TP2
  tp3Hits: number;        // Hit TP3 (full target)
  stoppedOut: number;
  expired: number;
  invalidated: number;
  
  // Win rates
  winRate: number;        // (TP hits) / (resolved signals)
  fullWinRate: number;    // (TP3 hits) / (resolved signals)
  lossRate: number;       // (stopped + expired) / (resolved signals)
  
  // Returns
  avgPnl: number;
  avgWinPnl: number;
  avgLossPnl: number;
  totalPnl: number;
  profitFactor: number;   // gross profit / gross loss
  
  // Time metrics
  avgTimeToTP1Hours: number;
  avgTimeToStopHours: number;
  
  // By direction
  longStats: DirectionalStats;
  shortStats: DirectionalStats;
}

export interface DirectionalStats {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPnl: number;
}

export interface TokenPerformanceStats {
  tokenSymbol: string;
  tokenAddress: string;
  total: number;
  
  // Outcomes
  tp1Hits: number;
  tp2Hits: number;
  tp3Hits: number;
  stoppedOut: number;
  expired: number;
  
  // Metrics
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  
  // Best/worst
  bestPnl: number;
  worstPnl: number;
  
  // Recent performance
  last5WinRate: number;
}

export interface PriceCheck {
  signalId: string;
  price: number;
  pnlPercent: number;
  timestamp: string;
  statusChange?: SignalStatus;
}

export interface PerformanceLeaderboard {
  best: TokenPerformanceStats[];
  worst: TokenPerformanceStats[];
  mostActive: TokenPerformanceStats[];
  highestWinRate: TokenPerformanceStats[];
}
