// Backtesting API Routes

import { Hono } from 'hono';
import { BacktestEngine } from './engine.js';
import { getBacktestDB } from './database.js';
import { ALL_STRATEGIES, getStrategy } from './strategies.js';
import type { BacktestConfig } from './types.js';

export const backtestRoutes = new Hono();

/**
 * GET /backtest/strategies - List all available strategies
 */
backtestRoutes.get('/backtest/strategies', (c) => {
  return c.json({
    success: true,
    count: ALL_STRATEGIES.length,
    strategies: ALL_STRATEGIES.map(s => ({
      name: s.name,
      description: s.description,
      signals: s.signals.length,
      stopLoss: s.stopLoss?.value,
      takeProfit: s.takeProfit?.value,
    })),
  });
});

/**
 * POST /backtest/run - Run a backtest
 * Body: { symbol, address, strategy, startDate, endDate, timeframe, initialCapital, positionSize }
 */
backtestRoutes.post('/backtest/run', async (c) => {
  try {
    const body = await c.req.json();
    const {
      symbol,
      address,
      strategyName,
      startDate,
      endDate,
      timeframe = '4H',
      initialCapital = 10000,
      positionSize = 10,
    } = body;

    // Validate inputs
    if (!symbol || !address || !strategyName) {
      return c.json({
        success: false,
        error: 'Missing required fields: symbol, address, strategyName',
      }, 400);
    }

    const strategy = getStrategy(strategyName);
    if (!strategy) {
      return c.json({
        success: false,
        error: `Strategy not found: ${strategyName}`,
        availableStrategies: ALL_STRATEGIES.map(s => s.name),
      }, 400);
    }

    // Create config
    const config: BacktestConfig = {
      symbol,
      address,
      startDate: startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: endDate || new Date().toISOString(),
      timeframe,
      initialCapital,
      positionSize,
      strategy,
    };

    console.log(`[Backtest API] Running backtest: ${strategy.name} on ${symbol}`);

    // Run backtest
    const engine = new BacktestEngine(config);
    const result = await engine.run();

    // Save to database
    const db = getBacktestDB();
    db.saveResult(result);

    return c.json({
      success: true,
      result: {
        strategy: strategy.name,
        symbol,
        timeframe,
        metrics: result.metrics,
        analysis: result.analysis,
        trades: result.trades.slice(0, 20), // Return first 20 trades
        totalTrades: result.trades.length,
      },
    });
  } catch (error: any) {
    console.error('[Backtest API] Error:', error);
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
});

/**
 * POST /backtest/batch - Run multiple backtests
 * Body: { symbols: Array<{symbol, address}>, strategies: string[], timeframe, ... }
 */
backtestRoutes.post('/backtest/batch', async (c) => {
  try {
    const body = await c.req.json();
    const {
      symbols = [],
      strategies = [],
      startDate,
      endDate,
      timeframe = '4H',
      initialCapital = 10000,
      positionSize = 10,
    } = body;

    if (symbols.length === 0 || strategies.length === 0) {
      return c.json({
        success: false,
        error: 'Must provide at least one symbol and one strategy',
      }, 400);
    }

    const results = [];
    const errors = [];

    console.log(`[Backtest API] Running batch: ${strategies.length} strategies × ${symbols.length} symbols`);

    for (const strategyName of strategies) {
      const strategy = getStrategy(strategyName);
      if (!strategy) {
        errors.push(`Strategy not found: ${strategyName}`);
        continue;
      }

      for (const { symbol, address } of symbols) {
        try {
          const config: BacktestConfig = {
            symbol,
            address,
            startDate: startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: endDate || new Date().toISOString(),
            timeframe,
            initialCapital,
            positionSize,
            strategy,
          };

          const engine = new BacktestEngine(config);
          const result = await engine.run();

          // Save to database
          const db = getBacktestDB();
          db.saveResult(result);

          results.push({
            symbol,
            strategy: strategy.name,
            winRate: result.metrics.winRate,
            totalReturn: result.metrics.totalReturn,
            profitFactor: result.metrics.profitFactor,
            totalTrades: result.metrics.totalTrades,
          });
        } catch (error: any) {
          errors.push(`${symbol} × ${strategyName}: ${error.message}`);
        }
      }
    }

    return c.json({
      success: true,
      completed: results.length,
      errors: errors.length,
      results,
      errorMessages: errors,
    });
  } catch (error: any) {
    console.error('[Backtest API] Batch error:', error);
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
});

/**
 * GET /backtest/results - Get all backtest results
 */
backtestRoutes.get('/backtest/results', (c) => {
  try {
    const db = getBacktestDB();
    const results = db.getAllResults();

    return c.json({
      success: true,
      count: results.length,
      results: results.map(r => ({
        id: r.id,
        strategy: r.strategyName,
        symbol: r.symbol,
        timeframe: r.timeframe,
        winRate: r.winRate,
        totalReturn: r.totalReturn,
        profitFactor: r.profitFactor,
        totalTrades: r.totalTrades,
        createdAt: r.createdAt,
      })),
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
});

/**
 * GET /backtest/results/:id - Get specific backtest result
 */
backtestRoutes.get('/backtest/results/:id', (c) => {
  try {
    const id = c.req.param('id');
    const db = getBacktestDB();
    const results = db.getAllResults();
    const result = results.find(r => r.id === id);

    if (!result) {
      return c.json({
        success: false,
        error: 'Backtest result not found',
      }, 404);
    }

    return c.json({
      success: true,
      result: JSON.parse(result.result),
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
});

/**
 * GET /backtest/analysis/strategies - Get best performing strategies
 */
backtestRoutes.get('/backtest/analysis/strategies', (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '10');
    const db = getBacktestDB();
    const strategies = db.getBestStrategies(limit);

    return c.json({
      success: true,
      count: strategies.length,
      strategies: strategies.map((s: any) => ({
        name: s.strategy_name,
        testCount: s.test_count,
        avgWinRate: parseFloat(s.avg_win_rate?.toFixed(2) || '0'),
        avgReturn: parseFloat(s.avg_return?.toFixed(2) || '0'),
        avgProfitFactor: parseFloat(s.avg_profit_factor?.toFixed(2) || '0'),
        avgSharpeRatio: parseFloat(s.avg_sharpe_ratio?.toFixed(2) || '0'),
        totalTrades: s.total_trades,
      })),
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
});

/**
 * GET /backtest/analysis/symbols/:symbol - Get stats for a specific symbol
 */
backtestRoutes.get('/backtest/analysis/symbols/:symbol', (c) => {
  try {
    const symbol = c.req.param('symbol');
    const db = getBacktestDB();
    const stats = db.getSymbolStats(symbol);

    if (!stats || stats.test_count === 0) {
      return c.json({
        success: false,
        error: `No backtest data found for ${symbol}`,
      }, 404);
    }

    const results = db.getResultsBySymbol(symbol);

    return c.json({
      success: true,
      symbol,
      stats: {
        testCount: stats.test_count,
        avgWinRate: parseFloat(stats.avg_win_rate?.toFixed(2) || '0'),
        avgReturn: parseFloat(stats.avg_return?.toFixed(2) || '0'),
        avgProfitFactor: parseFloat(stats.avg_profit_factor?.toFixed(2) || '0'),
        bestWinRate: parseFloat(stats.best_win_rate?.toFixed(2) || '0'),
        bestReturn: parseFloat(stats.best_return?.toFixed(2) || '0'),
      },
      topResults: results.slice(0, 5).map(r => ({
        strategy: r.strategyName,
        winRate: r.winRate,
        totalReturn: r.totalReturn,
        profitFactor: r.profitFactor,
      })),
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
});

/**
 * GET /backtest/health - Health check
 */
backtestRoutes.get('/backtest/health', (c) => {
  try {
    const db = getBacktestDB();
    const results = db.getAllResults();
    
    return c.json({
      success: true,
      status: 'operational',
      strategies: ALL_STRATEGIES.length,
      storedResults: results.length,
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
});

export default backtestRoutes;
