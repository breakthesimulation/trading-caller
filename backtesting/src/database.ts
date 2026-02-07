// Backtesting Database - SQLite storage for backtest results

import Database from 'better-sqlite3';
import { join } from 'path';
import type { BacktestResult, BacktestStorageRecord } from './types.js';

const DB_PATH = join(process.cwd(), 'data', 'backtesting.db');

export class BacktestDatabase {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.initialize();
  }

  /**
   * Initialize database schema
   */
  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS backtest_results (
        id TEXT PRIMARY KEY,
        strategy_name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        win_rate REAL NOT NULL,
        total_return REAL NOT NULL,
        profit_factor REAL NOT NULL,
        total_trades INTEGER NOT NULL,
        sharpe_ratio REAL,
        max_drawdown REAL,
        result TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_strategy ON backtest_results(strategy_name);
      CREATE INDEX IF NOT EXISTS idx_symbol ON backtest_results(symbol);
      CREATE INDEX IF NOT EXISTS idx_win_rate ON backtest_results(win_rate);
      CREATE INDEX IF NOT EXISTS idx_created_at ON backtest_results(created_at);
    `);

    console.log('[BacktestDB] Database initialized');
  }

  /**
   * Save backtest result
   */
  saveResult(result: BacktestResult): void {
    const id = `bt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const record: BacktestStorageRecord = {
      id,
      strategyName: result.config.strategy.name,
      symbol: result.config.symbol,
      timeframe: result.config.timeframe,
      startDate: result.config.startDate,
      endDate: result.config.endDate,
      winRate: result.metrics.winRate,
      totalReturn: result.metrics.totalReturn,
      profitFactor: result.metrics.profitFactor,
      totalTrades: result.metrics.totalTrades,
      result: JSON.stringify(result),
      createdAt: new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      INSERT INTO backtest_results (
        id, strategy_name, symbol, timeframe, start_date, end_date,
        win_rate, total_return, profit_factor, total_trades, 
        sharpe_ratio, max_drawdown, result, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.strategyName,
      record.symbol,
      record.timeframe,
      record.startDate,
      record.endDate,
      record.winRate,
      record.totalReturn,
      record.profitFactor,
      record.totalTrades,
      result.metrics.sharpeRatio,
      result.metrics.maxDrawdown,
      record.result,
      record.createdAt
    );

    console.log(`[BacktestDB] Saved result: ${id} (${record.strategyName} on ${record.symbol})`);
  }

  /**
   * Get all backtest results
   */
  getAllResults(): BacktestStorageRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM backtest_results 
      ORDER BY created_at DESC
    `);
    
    return stmt.all() as any[];
  }

  /**
   * Get results by strategy
   */
  getResultsByStrategy(strategyName: string): BacktestStorageRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM backtest_results 
      WHERE strategy_name = ?
      ORDER BY win_rate DESC
    `);
    
    return stmt.all(strategyName) as any[];
  }

  /**
   * Get results by symbol
   */
  getResultsBySymbol(symbol: string): BacktestStorageRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM backtest_results 
      WHERE symbol = ?
      ORDER BY win_rate DESC
    `);
    
    return stmt.all(symbol) as any[];
  }

  /**
   * Get best performing strategies
   */
  getBestStrategies(limit: number = 10): any[] {
    const stmt = this.db.prepare(`
      SELECT 
        strategy_name,
        COUNT(*) as test_count,
        AVG(win_rate) as avg_win_rate,
        AVG(total_return) as avg_return,
        AVG(profit_factor) as avg_profit_factor,
        AVG(sharpe_ratio) as avg_sharpe_ratio,
        SUM(total_trades) as total_trades
      FROM backtest_results
      GROUP BY strategy_name
      HAVING test_count >= 3
      ORDER BY avg_win_rate DESC
      LIMIT ?
    `);
    
    return stmt.all(limit) as any[];
  }

  /**
   * Get statistics by symbol
   */
  getSymbolStats(symbol: string): any {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as test_count,
        AVG(win_rate) as avg_win_rate,
        AVG(total_return) as avg_return,
        AVG(profit_factor) as avg_profit_factor,
        MAX(win_rate) as best_win_rate,
        MAX(total_return) as best_return
      FROM backtest_results
      WHERE symbol = ?
    `);
    
    return stmt.get(symbol);
  }

  /**
   * Delete old results (keep only last 1000)
   */
  pruneOldResults(): number {
    const stmt = this.db.prepare(`
      DELETE FROM backtest_results
      WHERE id NOT IN (
        SELECT id FROM backtest_results
        ORDER BY created_at DESC
        LIMIT 1000
      )
    `);
    
    const result = stmt.run();
    return result.changes;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Singleton instance
let dbInstance: BacktestDatabase | null = null;

export function getBacktestDB(): BacktestDatabase {
  if (!dbInstance) {
    dbInstance = new BacktestDatabase();
  }
  return dbInstance;
}
