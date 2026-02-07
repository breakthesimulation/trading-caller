// Backtesting Engine - Core logic for simulating historical trades

import type { 
  BacktestConfig, 
  BacktestResult, 
  Trade, 
  BacktestMetrics,
  EquityPoint,
  StrategyAnalysis,
  TradingStrategy,
} from './types.js';
import type { OHLCV } from '../../research-engine/src/signals/types.js';
import { getOHLCV } from '../../research-engine/src/data/birdeye.js';
import { calculateRSIFromOHLCV } from '../../research-engine/src/technical/rsi.js';
import { calculateMACD } from '../../research-engine/src/technical/macd.js';
import { detectTrend } from '../../research-engine/src/technical/trend.js';

export class BacktestEngine {
  private data: OHLCV[] = [];
  private config: BacktestConfig;
  private trades: Trade[] = [];
  private currentCapital: number;
  private equity: EquityPoint[] = [];
  private currentPosition: Trade | null = null;

  constructor(config: BacktestConfig) {
    this.config = config;
    this.currentCapital = config.initialCapital;
  }

  /**
   * Run the backtest
   */
  async run(): Promise<BacktestResult> {
    console.log(`[Backtest] Starting backtest for ${this.config.symbol} (${this.config.strategy.name})`);
    
    // Fetch historical data
    await this.loadData();
    
    if (this.data.length === 0) {
      throw new Error('No historical data available for backtesting');
    }

    console.log(`[Backtest] Loaded ${this.data.length} candles`);

    // Simulate trading
    await this.simulateTrades();

    // Calculate metrics
    const metrics = this.calculateMetrics();
    
    // Analyze strategy
    const analysis = this.analyzeStrategy();

    const result: BacktestResult = {
      config: this.config,
      trades: this.trades,
      metrics,
      equity: this.equity,
      analysis,
      timestamp: new Date().toISOString(),
    };

    console.log(`[Backtest] Complete: ${metrics.totalTrades} trades, ${metrics.winRate.toFixed(2)}% win rate`);
    
    return result;
  }

  /**
   * Load historical OHLCV data
   */
  private async loadData(): Promise<void> {
    try {
      this.data = await getOHLCV(this.config.address, this.config.timeframe);
      
      // Filter by date range if specified
      if (this.config.startDate || this.config.endDate) {
        const startTime = this.config.startDate ? new Date(this.config.startDate).getTime() : 0;
        const endTime = this.config.endDate ? new Date(this.config.endDate).getTime() : Date.now();
        
        this.data = this.data.filter(candle => {
          const candleTime = candle.time * 1000;
          return candleTime >= startTime && candleTime <= endTime;
        });
      }
    } catch (error) {
      console.error('[Backtest] Failed to load data:', error);
      throw error;
    }
  }

  /**
   * Simulate trades based on strategy
   */
  private async simulateTrades(): Promise<void> {
    for (let i = 14; i < this.data.length; i++) {
      const candle = this.data[i];
      const historicalData = this.data.slice(0, i + 1);
      
      // Calculate indicators
      const rsi = calculateRSIFromOHLCV(historicalData);
      const macd = calculateMACD(historicalData);
      const trend = detectTrend(historicalData);
      
      // Check if we should exit current position
      if (this.currentPosition) {
        this.checkExit(candle, i, { rsi: rsi.value, macd, trend });
      }
      
      // Check if we should enter a new position
      if (!this.currentPosition) {
        this.checkEntry(candle, i, { rsi: rsi.value, macd, trend });
      }
      
      // Update equity curve
      const currentEquity = this.calculateCurrentEquity(candle.close);
      const maxEquity = Math.max(...this.equity.map(e => e.equity), currentEquity);
      const drawdown = maxEquity - currentEquity;
      const drawdownPercent = (drawdown / maxEquity) * 100;
      
      this.equity.push({
        timestamp: new Date(candle.time * 1000).toISOString(),
        equity: currentEquity,
        drawdown,
        drawdownPercent,
      });
    }
    
    // Close any remaining position
    if (this.currentPosition) {
      const lastCandle = this.data[this.data.length - 1];
      this.closePosition(lastCandle, 'END_OF_PERIOD');
    }
  }

  /**
   * Check if we should enter a position
   */
  private checkEntry(
    candle: OHLCV, 
    index: number, 
    indicators: { rsi: number; macd: any; trend: string }
  ): void {
    const strategy = this.config.strategy;
    let signalScore = 0;
    let action: 'LONG' | 'SHORT' | null = null;

    // Evaluate each signal rule
    for (const rule of strategy.signals) {
      if (rule.action === 'EXIT') continue;

      let conditionMet = false;
      
      switch (rule.type) {
        case 'RSI':
          conditionMet = this.evaluateRSISignal(rule.condition, indicators.rsi);
          break;
        case 'MACD':
          conditionMet = this.evaluateMACDSignal(rule.condition, indicators.macd);
          break;
        case 'TREND':
          conditionMet = this.evaluateTrendSignal(rule.condition, indicators.trend);
          break;
        case 'COMBINED':
          // For combined signals, we need multiple conditions to be true
          conditionMet = this.evaluateRSISignal(rule.condition, indicators.rsi) &&
                         indicators.trend === 'UPTREND';
          break;
      }

      if (conditionMet) {
        signalScore += rule.weight;
        if (!action) action = rule.action;
      }
    }

    // Enter trade if signal is strong enough (threshold: 50)
    if (action && signalScore >= 50) {
      this.openPosition(candle, action, indicators, signalScore);
    }
  }

  /**
   * Check if we should exit current position
   */
  private checkExit(
    candle: OHLCV,
    index: number,
    indicators: { rsi: number; macd: any; trend: string }
  ): void {
    if (!this.currentPosition) return;

    const position = this.currentPosition;
    const currentPrice = candle.close;

    // Check stop loss
    if (position.side === 'LONG' && currentPrice <= position.stopLoss) {
      this.closePosition(candle, 'STOP_LOSS');
      return;
    }
    if (position.side === 'SHORT' && currentPrice >= position.stopLoss) {
      this.closePosition(candle, 'STOP_LOSS');
      return;
    }

    // Check take profit
    if (position.side === 'LONG' && currentPrice >= position.takeProfit) {
      this.closePosition(candle, 'TAKE_PROFIT');
      return;
    }
    if (position.side === 'SHORT' && currentPrice <= position.takeProfit) {
      this.closePosition(candle, 'TAKE_PROFIT');
      return;
    }

    // Check exit signals
    const exitSignals = this.config.strategy.signals.filter(s => s.action === 'EXIT');
    for (const rule of exitSignals) {
      let shouldExit = false;
      
      switch (rule.type) {
        case 'RSI':
          shouldExit = this.evaluateRSISignal(rule.condition, indicators.rsi);
          break;
        case 'MACD':
          shouldExit = this.evaluateMACDSignal(rule.condition, indicators.macd);
          break;
      }

      if (shouldExit) {
        this.closePosition(candle, 'SIGNAL');
        return;
      }
    }
  }

  /**
   * Open a new position
   */
  private openPosition(
    candle: OHLCV,
    side: 'LONG' | 'SHORT',
    indicators: { rsi: number; macd: any; trend: string },
    signalScore: number
  ): void {
    const capital = this.currentCapital * (this.config.positionSize / 100);
    const entryPrice = candle.close;
    const size = capital / entryPrice;

    // Calculate stop loss and take profit
    const stopLossPercent = this.config.strategy.stopLoss?.value || 5;
    const takeProfitPercent = this.config.strategy.takeProfit?.value || 10;

    const stopLoss = side === 'LONG' 
      ? entryPrice * (1 - stopLossPercent / 100)
      : entryPrice * (1 + stopLossPercent / 100);

    const takeProfit = side === 'LONG'
      ? entryPrice * (1 + takeProfitPercent / 100)
      : entryPrice * (1 - takeProfitPercent / 100);

    this.currentPosition = {
      id: `trade_${this.trades.length + 1}`,
      entryTime: new Date(candle.time * 1000).toISOString(),
      entryPrice,
      side,
      size,
      capital,
      stopLoss,
      takeProfit,
      status: 'OPEN',
      indicators: {
        rsi: indicators.rsi,
        macd: indicators.macd,
        trend: indicators.trend,
        volume: candle.volume,
      },
    };
  }

  /**
   * Close current position
   */
  private closePosition(
    candle: OHLCV,
    reason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'SIGNAL' | 'END_OF_PERIOD'
  ): void {
    if (!this.currentPosition) return;

    const position = this.currentPosition;
    const exitPrice = candle.close;
    
    // Calculate PnL
    let pnl: number;
    if (position.side === 'LONG') {
      pnl = (exitPrice - position.entryPrice) * position.size;
    } else {
      pnl = (position.entryPrice - exitPrice) * position.size;
    }
    
    const pnlPercent = (pnl / position.capital) * 100;

    // Update capital
    this.currentCapital += pnl;

    // Determine status
    let status: Trade['status'];
    if (Math.abs(pnlPercent) < 0.1) {
      status = 'CLOSED_BREAKEVEN';
    } else if (pnl > 0) {
      status = 'CLOSED_WIN';
    } else {
      status = 'CLOSED_LOSS';
    }

    // Complete the trade
    const completedTrade: Trade = {
      ...position,
      exitTime: new Date(candle.time * 1000).toISOString(),
      exitPrice,
      status,
      pnl,
      pnlPercent,
      exitReason: reason,
    };

    this.trades.push(completedTrade);
    this.currentPosition = null;
  }

  /**
   * Calculate current equity
   */
  private calculateCurrentEquity(currentPrice: number): number {
    let equity = this.currentCapital;
    
    if (this.currentPosition) {
      const position = this.currentPosition;
      let unrealizedPnl: number;
      
      if (position.side === 'LONG') {
        unrealizedPnl = (currentPrice - position.entryPrice) * position.size;
      } else {
        unrealizedPnl = (position.entryPrice - currentPrice) * position.size;
      }
      
      equity += unrealizedPnl;
    }
    
    return equity;
  }

  /**
   * Evaluate RSI signal condition
   */
  private evaluateRSISignal(condition: string, rsi: number): boolean {
    // Parse conditions like "RSI < 30", "RSI > 70", etc.
    if (condition.includes('<')) {
      const threshold = parseFloat(condition.split('<')[1]);
      return rsi < threshold;
    }
    if (condition.includes('>')) {
      const threshold = parseFloat(condition.split('>')[1]);
      return rsi > threshold;
    }
    return false;
  }

  /**
   * Evaluate MACD signal condition
   */
  private evaluateMACDSignal(condition: string, macd: any): boolean {
    if (!macd) return false;
    
    if (condition.includes('CROSS_ABOVE')) {
      return macd.histogram > 0 && Math.abs(macd.histogram) < 0.5;
    }
    if (condition.includes('CROSS_BELOW')) {
      return macd.histogram < 0 && Math.abs(macd.histogram) < 0.5;
    }
    if (condition.includes('> 0')) {
      return macd.value > macd.signal;
    }
    if (condition.includes('< 0')) {
      return macd.value < macd.signal;
    }
    return false;
  }

  /**
   * Evaluate trend signal condition
   */
  private evaluateTrendSignal(condition: string, trend: string): boolean {
    return condition.toUpperCase().includes(trend.toUpperCase());
  }

  /**
   * Calculate backtest metrics
   */
  private calculateMetrics(): BacktestMetrics {
    const winningTrades = this.trades.filter(t => t.status === 'CLOSED_WIN');
    const losingTrades = this.trades.filter(t => t.status === 'CLOSED_LOSS');
    const breakEvenTrades = this.trades.filter(t => t.status === 'CLOSED_BREAKEVEN');

    const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));

    const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    const totalReturn = this.currentCapital - this.config.initialCapital;
    const totalReturnPercent = (totalReturn / this.config.initialCapital) * 100;

    // Calculate Sharpe Ratio (simplified)
    const returns = this.trades.map(t => t.pnlPercent || 0);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

    // Calculate max drawdown
    const maxDrawdown = Math.max(...this.equity.map(e => e.drawdown), 0);
    const maxDrawdownPercent = Math.max(...this.equity.map(e => e.drawdownPercent), 0);

    // Calculate average trade duration
    const durations = this.trades
      .filter(t => t.exitTime)
      .map(t => {
        const entry = new Date(t.entryTime).getTime();
        const exit = new Date(t.exitTime!).getTime();
        return (exit - entry) / (1000 * 60 * 60); // Convert to hours
      });
    const avgTradeDuration = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0;

    // Calculate average risk/reward ratio
    const rrRatios = this.trades
      .filter(t => t.pnl !== undefined)
      .map(t => {
        const risk = Math.abs(t.entryPrice - t.stopLoss);
        const reward = Math.abs(t.takeProfit - t.entryPrice);
        return reward / risk;
      });
    const avgRiskRewardRatio = rrRatios.length > 0
      ? rrRatios.reduce((sum, r) => sum + r, 0) / rrRatios.length
      : 0;

    return {
      totalTrades: this.trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      breakEvenTrades: breakEvenTrades.length,
      winRate: this.trades.length > 0 ? (winningTrades.length / this.trades.length) * 100 : 0,
      avgWin,
      avgLoss,
      largestWin: Math.max(...winningTrades.map(t => t.pnl || 0), 0),
      largestLoss: Math.min(...losingTrades.map(t => t.pnl || 0), 0),
      profitFactor,
      totalReturn,
      totalReturnPercent,
      sharpeRatio,
      maxDrawdown,
      maxDrawdownPercent,
      avgTradeDuration,
      avgRiskRewardRatio,
    };
  }

  /**
   * Analyze strategy performance
   */
  private analyzeStrategy(): StrategyAnalysis {
    // Analyze RSI levels
    const rsiLevels: { [key: string]: { wins: number; total: number; returns: number[] } } = {};
    
    this.trades.forEach(trade => {
      if (!trade.indicators?.rsi) return;
      
      const rsi = trade.indicators.rsi;
      let level: string;
      if (rsi < 30) level = 'Oversold (<30)';
      else if (rsi > 70) level = 'Overbought (>70)';
      else level = 'Neutral (30-70)';
      
      if (!rsiLevels[level]) {
        rsiLevels[level] = { wins: 0, total: 0, returns: [] };
      }
      
      rsiLevels[level].total++;
      if (trade.status === 'CLOSED_WIN') rsiLevels[level].wins++;
      if (trade.pnlPercent) rsiLevels[level].returns.push(trade.pnlPercent);
    });

    const bestRSILevels = Object.entries(rsiLevels)
      .map(([level, data]) => ({
        level,
        winRate: (data.wins / data.total) * 100,
        avgReturn: data.returns.reduce((sum, r) => sum + r, 0) / data.returns.length,
      }))
      .sort((a, b) => b.winRate - a.winRate);

    // Analyze trend alignment
    const withTrend = this.trades.filter(t => 
      (t.side === 'LONG' && t.indicators?.trend === 'UPTREND') ||
      (t.side === 'SHORT' && t.indicators?.trend === 'DOWNTREND')
    );
    const againstTrend = this.trades.filter(t =>
      (t.side === 'LONG' && t.indicators?.trend === 'DOWNTREND') ||
      (t.side === 'SHORT' && t.indicators?.trend === 'UPTREND')
    );

    const trendAlignment = {
      withTrend: {
        trades: withTrend.length,
        winRate: withTrend.length > 0 
          ? (withTrend.filter(t => t.status === 'CLOSED_WIN').length / withTrend.length) * 100 
          : 0,
      },
      againstTrend: {
        trades: againstTrend.length,
        winRate: againstTrend.length > 0
          ? (againstTrend.filter(t => t.status === 'CLOSED_WIN').length / againstTrend.length) * 100
          : 0,
      },
    };

    // Generate recommendations
    const recommendations: string[] = [];
    
    const metrics = this.calculateMetrics();
    if (metrics.winRate < 50) {
      recommendations.push('Consider tightening entry criteria or adjusting stop-loss levels');
    }
    if (metrics.profitFactor < 1.5) {
      recommendations.push('Profit factor is low - review risk/reward ratio');
    }
    if (trendAlignment.withTrend.winRate > trendAlignment.againstTrend.winRate + 10) {
      recommendations.push('Trading with the trend shows significantly better results');
    }
    if (bestRSILevels.length > 0 && bestRSILevels[0].winRate > 60) {
      recommendations.push(`${bestRSILevels[0].level} RSI levels show best performance`);
    }

    return {
      bestTimeframes: [{ timeframe: this.config.timeframe, winRate: metrics.winRate }],
      bestRSILevels,
      trendAlignment,
      volumeAnalysis: {
        highVolume: { trades: 0, winRate: 0 },
        lowVolume: { trades: 0, winRate: 0 },
      },
      recommendations,
    };
  }
}
