/**
 * Positions API Routes
 * 
 * Track and display trading positions with P&L, win rate, and performance metrics
 */

import { Hono } from 'hono';
import { performanceTracker } from '../../performance/tracker.js';
import { storage } from '../../performance/storage.js';
import type { TrackedSignal } from '../../performance/types.js';

const app = new Hono();

// ============ HELPER FUNCTIONS ============

function calculateTimeInPosition(createdAt: string, resolvedAt?: string): {
  hours: number;
  minutes: number;
  display: string;
} {
  const start = new Date(createdAt);
  const end = resolvedAt ? new Date(resolvedAt) : new Date();
  const diffMs = end.getTime() - start.getTime();
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return {
    hours,
    minutes,
    display: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
  };
}

function formatPosition(signal: TrackedSignal) {
  const time = calculateTimeInPosition(signal.createdAt, signal.resolvedAt);
  const isOpen = signal.status === 'ACTIVE';
  const pnl = signal.pnlPercent || 0;
  
  return {
    id: signal.id,
    token: {
      symbol: signal.tokenSymbol,
      address: signal.tokenAddress,
    },
    action: signal.action,
    status: signal.status,
    
    // Prices
    entry: signal.entryPrice,
    current: signal.exitPrice || signal.entryPrice,
    targets: {
      tp1: signal.tp1,
      tp2: signal.tp2,
      tp3: signal.tp3,
      hit: {
        tp1: !!signal.tp1HitAt,
        tp2: !!signal.tp2HitAt,
        tp3: !!signal.tp3HitAt,
      },
    },
    stopLoss: signal.stopLoss,
    
    // Performance
    pnl: pnl,
    highestPnl: signal.highestPnl || pnl,
    lowestPnl: signal.lowestPnl || pnl,
    
    // Timing
    timeInPosition: time.display,
    timeInPositionHours: time.hours + (time.minutes / 60),
    openedAt: signal.createdAt,
    closedAt: signal.resolvedAt,
    expiresAt: signal.expiresAt,
    
    // Metadata
    confidence: signal.confidence,
    timeframe: signal.timeframe,
    reasoning: signal.reasoning,
    indicators: signal.indicators,
    checkCount: signal.checkCount,
    lastChecked: signal.lastCheckedAt,
  };
}

// ============ API ENDPOINTS ============

/**
 * GET /positions/open - Get all open positions
 */
app.get('/positions/open', (c) => {
  const activeSignals = storage.getActiveSignals();
  
  const positions = activeSignals.map(formatPosition).sort((a, b) => {
    // Sort by PnL (best performing first)
    return b.pnl - a.pnl;
  });
  
  // Calculate aggregate stats
  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const avgPnl = positions.length > 0 ? totalPnl / positions.length : 0;
  const bestPnl = positions.length > 0 ? Math.max(...positions.map(p => p.pnl)) : 0;
  const worstPnl = positions.length > 0 ? Math.min(...positions.map(p => p.pnl)) : 0;
  
  return c.json({
    success: true,
    count: positions.length,
    stats: {
      totalPnl: parseFloat(totalPnl.toFixed(2)),
      avgPnl: parseFloat(avgPnl.toFixed(2)),
      bestPnl: parseFloat(bestPnl.toFixed(2)),
      worstPnl: parseFloat(worstPnl.toFixed(2)),
    },
    positions,
  });
});

/**
 * GET /positions/closed - Get closed positions with pagination
 */
app.get('/positions/closed', (c) => {
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');
  const filter = c.req.query('filter'); // 'wins', 'losses', 'all'
  
  const allSignals = storage.getAllSignals({ 
    status: ['TP1_HIT', 'TP2_HIT', 'TP3_HIT', 'STOPPED_OUT', 'EXPIRED'],
  });
  
  let filtered = allSignals;
  
  // Apply filter
  if (filter === 'wins') {
    filtered = allSignals.filter(s => 
      ['TP1_HIT', 'TP2_HIT', 'TP3_HIT'].includes(s.status)
    );
  } else if (filter === 'losses') {
    filtered = allSignals.filter(s => 
      ['STOPPED_OUT', 'EXPIRED'].includes(s.status)
    );
  }
  
  const paginatedSignals = filtered.slice(offset, offset + limit);
  const positions = paginatedSignals.map(formatPosition);
  
  return c.json({
    success: true,
    total: filtered.length,
    offset,
    limit,
    filter: filter || 'all',
    positions,
  });
});

/**
 * GET /positions/stats - Get comprehensive position statistics
 */
app.get('/positions/stats', (c) => {
  const stats = storage.getPerformanceStats();
  
  // Get best and worst trades
  const allClosed = storage.getAllSignals({ 
    status: ['TP1_HIT', 'TP2_HIT', 'TP3_HIT', 'STOPPED_OUT', 'EXPIRED'],
  });
  
  const sortedByPnl = allClosed
    .filter(s => s.pnlPercent !== undefined)
    .sort((a, b) => (b.pnlPercent || 0) - (a.pnlPercent || 0));
  
  const bestTrade = sortedByPnl[0] ? formatPosition(sortedByPnl[0]) : null;
  const worstTrade = sortedByPnl[sortedByPnl.length - 1] 
    ? formatPosition(sortedByPnl[sortedByPnl.length - 1]) 
    : null;
  
  // Calculate average time in winning vs losing positions
  const wins = allClosed.filter(s => ['TP1_HIT', 'TP2_HIT', 'TP3_HIT'].includes(s.status));
  const losses = allClosed.filter(s => ['STOPPED_OUT', 'EXPIRED'].includes(s.status));
  
  const avgWinTime = wins.length > 0
    ? wins.reduce((sum, s) => sum + calculateTimeInPosition(s.createdAt, s.resolvedAt).hours, 0) / wins.length
    : 0;
  
  const avgLossTime = losses.length > 0
    ? losses.reduce((sum, s) => sum + calculateTimeInPosition(s.createdAt, s.resolvedAt).hours, 0) / losses.length
    : 0;
  
  return c.json({
    success: true,
    stats: {
      // Overall
      totalPositions: stats.total,
      openPositions: stats.active,
      closedPositions: stats.total - stats.active,
      
      // P&L
      totalPnl: parseFloat(stats.totalPnl.toFixed(2)),
      avgPnl: parseFloat(stats.avgPnl.toFixed(2)),
      avgWinPnl: parseFloat(stats.avgWinPnl.toFixed(2)),
      avgLossPnl: parseFloat(stats.avgLossPnl.toFixed(2)),
      
      // Win rates
      winRate: parseFloat(stats.winRate.toFixed(2)),
      fullWinRate: parseFloat(stats.fullWinRate.toFixed(2)),
      lossRate: parseFloat(stats.lossRate.toFixed(2)),
      
      // Outcomes
      wins: stats.tp1Hits + stats.tp2Hits + stats.tp3Hits,
      losses: stats.stoppedOut + stats.expired,
      tp1Hits: stats.tp1Hits,
      tp2Hits: stats.tp2Hits,
      tp3Hits: stats.tp3Hits,
      stoppedOut: stats.stoppedOut,
      expired: stats.expired,
      
      // Profit factor
      profitFactor: parseFloat(stats.profitFactor.toFixed(2)),
      
      // Time metrics
      avgTimeToTP1Hours: parseFloat(stats.avgTimeToTP1Hours.toFixed(1)),
      avgTimeToStopHours: parseFloat(stats.avgTimeToStopHours.toFixed(1)),
      avgWinTimeHours: parseFloat(avgWinTime.toFixed(1)),
      avgLossTimeHours: parseFloat(avgLossTime.toFixed(1)),
      
      // Directional stats
      long: {
        total: stats.longStats.total,
        wins: stats.longStats.wins,
        losses: stats.longStats.losses,
        winRate: parseFloat(stats.longStats.winRate.toFixed(2)),
        avgPnl: parseFloat(stats.longStats.avgPnl.toFixed(2)),
      },
      short: {
        total: stats.shortStats.total,
        wins: stats.shortStats.wins,
        losses: stats.shortStats.losses,
        winRate: parseFloat(stats.shortStats.winRate.toFixed(2)),
        avgPnl: parseFloat(stats.shortStats.avgPnl.toFixed(2)),
      },
      
      // Best/worst trades
      bestTrade,
      worstTrade,
    },
  });
});

/**
 * GET /positions/:id - Get details for a specific position
 */
app.get('/positions/:id', (c) => {
  const id = c.req.param('id');
  const signal = storage.getSignal(id);
  
  if (!signal) {
    return c.json({
      success: false,
      error: 'Position not found',
    }, 404);
  }
  
  return c.json({
    success: true,
    position: formatPosition(signal),
  });
});

/**
 * GET /positions/token/:symbol - Get positions for a specific token
 */
app.get('/positions/token/:symbol', (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  
  const allSignals = storage.getAllSignals();
  const tokenSignals = allSignals.filter(s => s.tokenSymbol === symbol);
  
  if (tokenSignals.length === 0) {
    return c.json({
      success: false,
      error: `No positions found for ${symbol}`,
    }, 404);
  }
  
  const positions = tokenSignals.map(formatPosition);
  
  // Calculate token-specific stats
  const wins = tokenSignals.filter(s => ['TP1_HIT', 'TP2_HIT', 'TP3_HIT'].includes(s.status));
  const losses = tokenSignals.filter(s => ['STOPPED_OUT', 'EXPIRED'].includes(s.status));
  const winRate = (wins.length / (wins.length + losses.length)) * 100 || 0;
  
  const totalPnl = tokenSignals
    .filter(s => s.pnlPercent !== undefined)
    .reduce((sum, s) => sum + (s.pnlPercent || 0), 0);
  
  return c.json({
    success: true,
    token: symbol,
    count: positions.length,
    stats: {
      wins: wins.length,
      losses: losses.length,
      winRate: parseFloat(winRate.toFixed(2)),
      totalPnl: parseFloat(totalPnl.toFixed(2)),
    },
    positions,
  });
});

export default app;
