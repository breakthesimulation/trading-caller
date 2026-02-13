/**
 * Performance API Routes
 * 
 * Endpoints for signal performance tracking:
 * - GET /signals/performance - Overall stats
 * - GET /signals/:id/status - Individual signal status
 * - GET /leaderboard/tokens - Token performance leaderboard
 */

import { Hono } from 'hono';
import { performanceTracker, performanceScheduler, storage } from '../../performance/index.js';

const performanceRoutes = new Hono();

// ============ SIGNAL PERFORMANCE ENDPOINTS ============

/**
 * GET /signals/performance
 * 
 * Overall performance statistics including:
 * - Win rates (TP1/TP2/TP3 hit rates)
 * - Average PnL
 * - Profit factor
 * - Long vs Short performance
 */
performanceRoutes.get('/signals/performance', (c) => {
  try {
    const stats = performanceTracker.getPerformanceSummary();
    
    return c.json({
      success: true,
      performance: {
        summary: {
          total: stats.total,
          active: stats.active,
          resolved: stats.total - stats.active - stats.invalidated,
        },
        outcomes: {
          tp1Hits: stats.tp1Hits,
          tp2Hits: stats.tp2Hits,
          tp3Hits: stats.tp3Hits,
          stoppedOut: stats.stoppedOut,
          expired: stats.expired,
          invalidated: stats.invalidated,
        },
        rates: {
          winRate: `${stats.winRate.toFixed(1)}%`,
          fullWinRate: `${stats.fullWinRate.toFixed(1)}%`,
          lossRate: `${stats.lossRate.toFixed(1)}%`,
        },
        pnl: {
          average: `${stats.avgPnl >= 0 ? '+' : ''}${stats.avgPnl.toFixed(2)}%`,
          averageWin: `+${stats.avgWinPnl.toFixed(2)}%`,
          averageLoss: `${stats.avgLossPnl.toFixed(2)}%`,
          total: `${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}%`,
          profitFactor: stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2),
        },
        timing: {
          avgTimeToTP1: `${stats.avgTimeToTP1Hours.toFixed(1)}h`,
          avgTimeToStop: `${stats.avgTimeToStopHours.toFixed(1)}h`,
        },
        byDirection: {
          long: {
            total: stats.longStats.total,
            wins: stats.longStats.wins,
            losses: stats.longStats.losses,
            winRate: `${stats.longStats.winRate.toFixed(1)}%`,
            avgPnl: `${stats.longStats.avgPnl >= 0 ? '+' : ''}${stats.longStats.avgPnl.toFixed(2)}%`,
          },
          short: {
            total: stats.shortStats.total,
            wins: stats.shortStats.wins,
            losses: stats.shortStats.losses,
            winRate: `${stats.shortStats.winRate.toFixed(1)}%`,
            avgPnl: `${stats.shortStats.avgPnl >= 0 ? '+' : ''}${stats.shortStats.avgPnl.toFixed(2)}%`,
          },
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[PerformanceAPI] Error getting performance stats:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get performance stats',
    }, 500);
  }
});

/**
 * GET /signals/:id/status
 * 
 * Get status of a specific signal including:
 * - Current status (ACTIVE, TP1_HIT, etc.)
 * - Which targets have been hit
 * - Current/final PnL
 * - Time active
 */
performanceRoutes.get('/signals/:id/status', (c) => {
  const signalId = c.req.param('id');
  
  try {
    const result = performanceTracker.getSignalStatus(signalId);
    
    if (!result.found) {
      return c.json({
        success: false,
        error: `Signal ${signalId} not found`,
      }, 404);
    }
    
    const signal = result.signal!;
    
    return c.json({
      success: true,
      signal: {
        id: signal.id,
        token: signal.tokenSymbol,
        action: signal.action,
        status: signal.status,
        
        // Price levels
        levels: {
          entry: signal.entryPrice,
          tp1: signal.tp1,
          tp2: signal.tp2,
          tp3: signal.tp3,
          stopLoss: signal.stopLoss,
          exit: signal.exitPrice,
        },
        
        // Progress
        progress: {
          targetsHit: result.targetsHit,
          pnl: signal.pnlPercent !== undefined 
            ? `${signal.pnlPercent >= 0 ? '+' : ''}${signal.pnlPercent.toFixed(2)}%`
            : null,
          highestPnl: signal.highestPnl !== undefined
            ? `${signal.highestPnl >= 0 ? '+' : ''}${signal.highestPnl.toFixed(2)}%`
            : null,
          lowestPnl: signal.lowestPnl !== undefined
            ? `${signal.lowestPnl >= 0 ? '+' : ''}${signal.lowestPnl.toFixed(2)}%`
            : null,
        },
        
        // Timing
        timing: {
          created: signal.createdAt,
          expires: signal.expiresAt,
          resolved: signal.resolvedAt,
          timeActive: result.timeActive,
          checksPerformed: signal.checkCount,
          lastChecked: signal.lastCheckedAt,
        },
        
        // Metadata
        metadata: {
          confidence: signal.confidence,
          timeframe: signal.timeframe,
          reasoning: signal.reasoning,
        },
      },
    });
  } catch (error) {
    console.error('[PerformanceAPI] Error getting signal status:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get signal status',
    }, 500);
  }
});

/**
 * GET /signals/tracked
 * 
 * List tracked signals with optional filters
 */
performanceRoutes.get('/signals/tracked', (c) => {
  const status = c.req.query('status');
  const token = c.req.query('token');
  const action = c.req.query('action') as 'LONG' | 'SHORT' | undefined;
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');
  
  try {
    const signals = performanceTracker.getSignals({
      status: status as any,
      token,
      action,
      limit,
      offset,
    });
    
    return c.json({
      success: true,
      count: signals.length,
      offset,
      limit,
      signals: signals.map(s => ({
        id: s.id,
        token: s.tokenSymbol,
        action: s.action,
        status: s.status,
        entry: s.entryPrice,
        targets: [s.tp1, s.tp2, s.tp3],
        stopLoss: s.stopLoss,
        pnl: s.pnlPercent !== undefined 
          ? `${s.pnlPercent >= 0 ? '+' : ''}${s.pnlPercent.toFixed(2)}%`
          : null,
        confidence: s.confidence,
        created: s.createdAt,
        resolved: s.resolvedAt,
      })),
    });
  } catch (error) {
    console.error('[PerformanceAPI] Error listing signals:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list signals',
    }, 500);
  }
});

// ============ TOKEN LEADERBOARD ENDPOINTS ============

/**
 * GET /leaderboard/tokens
 * 
 * Token performance leaderboard showing:
 * - Best performing tokens
 * - Worst performing tokens
 * - Most active tokens
 * - Highest win rate tokens
 */
performanceRoutes.get('/leaderboard/tokens', (c) => {
  try {
    const leaderboard = performanceTracker.getTokenLeaderboard();
    
    const formatToken = (t: any) => ({
      token: t.tokenSymbol,
      signals: t.total,
      outcomes: {
        tp1: t.tp1Hits,
        tp2: t.tp2Hits,
        tp3: t.tp3Hits,
        stopped: t.stoppedOut,
        expired: t.expired,
      },
      winRate: `${t.winRate.toFixed(1)}%`,
      avgPnl: `${t.avgPnl >= 0 ? '+' : ''}${t.avgPnl.toFixed(2)}%`,
      totalPnl: `${t.totalPnl >= 0 ? '+' : ''}${t.totalPnl.toFixed(2)}%`,
      bestTrade: `${t.bestPnl >= 0 ? '+' : ''}${t.bestPnl.toFixed(2)}%`,
      worstTrade: `${t.worstPnl >= 0 ? '+' : ''}${t.worstPnl.toFixed(2)}%`,
      last5WinRate: `${t.last5WinRate.toFixed(1)}%`,
    });
    
    return c.json({
      success: true,
      leaderboard: {
        best: leaderboard.best.map(formatToken),
        worst: leaderboard.worst.map(formatToken),
        mostActive: leaderboard.mostActive.map(formatToken),
        highestWinRate: leaderboard.highestWinRate.map(formatToken),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[PerformanceAPI] Error getting leaderboard:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get leaderboard',
    }, 500);
  }
});

/**
 * GET /leaderboard/tokens/:symbol
 * 
 * Get detailed performance for a specific token
 */
performanceRoutes.get('/leaderboard/tokens/:symbol', (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  
  try {
    const allStats = storage.getTokenPerformanceStats();
    const tokenStats = allStats.find(t => t.tokenSymbol === symbol);
    
    if (!tokenStats) {
      return c.json({
        success: false,
        error: `No performance data for token ${symbol}`,
      }, 404);
    }
    
    // Get recent signals for this token
    const recentSignals = performanceTracker.getSignals({
      token: symbol,
      limit: 10,
    });
    
    return c.json({
      success: true,
      token: symbol,
      performance: {
        total: tokenStats.total,
        outcomes: {
          tp1Hits: tokenStats.tp1Hits,
          tp2Hits: tokenStats.tp2Hits,
          tp3Hits: tokenStats.tp3Hits,
          stoppedOut: tokenStats.stoppedOut,
          expired: tokenStats.expired,
        },
        winRate: `${tokenStats.winRate.toFixed(1)}%`,
        avgPnl: `${tokenStats.avgPnl >= 0 ? '+' : ''}${tokenStats.avgPnl.toFixed(2)}%`,
        totalPnl: `${tokenStats.totalPnl >= 0 ? '+' : ''}${tokenStats.totalPnl.toFixed(2)}%`,
        bestTrade: `${tokenStats.bestPnl >= 0 ? '+' : ''}${tokenStats.bestPnl.toFixed(2)}%`,
        worstTrade: `${tokenStats.worstPnl >= 0 ? '+' : ''}${tokenStats.worstPnl.toFixed(2)}%`,
        last5WinRate: `${tokenStats.last5WinRate.toFixed(1)}%`,
      },
      recentSignals: recentSignals.map(s => ({
        id: s.id,
        action: s.action,
        status: s.status,
        entry: s.entryPrice,
        exit: s.exitPrice,
        pnl: s.pnlPercent !== undefined 
          ? `${s.pnlPercent >= 0 ? '+' : ''}${s.pnlPercent.toFixed(2)}%`
          : null,
        created: s.createdAt,
      })),
    });
  } catch (error) {
    console.error('[PerformanceAPI] Error getting token performance:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get token performance',
    }, 500);
  }
});

// ============ SCHEDULER CONTROL ENDPOINTS ============

/**
 * GET /performance/scheduler/status
 * 
 * Get performance scheduler status
 */
performanceRoutes.get('/performance/scheduler/status', (c) => {
  const status = performanceScheduler.getStatus();
  
  return c.json({
    success: true,
    scheduler: status,
  });
});

/**
 * POST /performance/scheduler/trigger
 * 
 * Manually trigger a price check cycle
 */
performanceRoutes.post('/performance/scheduler/trigger', async (c) => {
  try {
    console.log('[PerformanceAPI] Manual trigger requested');
    const results = await performanceScheduler.trigger();
    
    return c.json({
      success: true,
      message: 'Price check triggered',
      results,
    });
  } catch (error) {
    console.error('[PerformanceAPI] Trigger failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Trigger failed',
    }, 500);
  }
});

/**
 * POST /signals/reset
 *
 * Reset all tracked signals (clears performance history)
 */
performanceRoutes.post('/signals/reset', (c) => {
  try {
    storage.resetAllSignals();
    return c.json({
      success: true,
      message: 'All tracked signals have been reset',
    });
  } catch (error) {
    console.error('[PerformanceAPI] Error resetting signals:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset signals',
    }, 500);
  }
});

export default performanceRoutes;
