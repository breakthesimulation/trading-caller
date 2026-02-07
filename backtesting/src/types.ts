// Backtesting Types

export interface BacktestConfig {
  symbol: string;
  address: string;
  startDate: string;
  endDate: string;
  timeframe: '1H' | '4H' | '1D';
  initialCapital: number;
  positionSize: number; // Percentage of capital per trade
  strategy: TradingStrategy;
}

export interface TradingStrategy {
  name: string;
  description: string;
  signals: SignalRule[];
  stopLoss?: StopLossRule;
  takeProfit?: TakeProfitRule;
}

export interface SignalRule {
  type: 'RSI' | 'MACD' | 'TREND' | 'SUPPORT_RESISTANCE' | 'VOLUME' | 'COMBINED';
  action: 'LONG' | 'SHORT' | 'EXIT';
  condition: string; // e.g., "RSI < 30", "MACD > 0"
  weight: number; // Signal strength weight
}

export interface StopLossRule {
  type: 'FIXED_PERCENT' | 'ATR' | 'SUPPORT_LEVEL';
  value: number;
}

export interface TakeProfitRule {
  type: 'FIXED_PERCENT' | 'RISK_REWARD' | 'TRAILING';
  value: number;
}

export interface Trade {
  id: string;
  entryTime: string;
  entryPrice: number;
  exitTime?: string;
  exitPrice?: number;
  side: 'LONG' | 'SHORT';
  size: number; // In tokens
  capital: number; // USD invested
  stopLoss: number;
  takeProfit: number;
  status: 'OPEN' | 'CLOSED_WIN' | 'CLOSED_LOSS' | 'CLOSED_BREAKEVEN';
  pnl?: number;
  pnlPercent?: number;
  exitReason?: 'STOP_LOSS' | 'TAKE_PROFIT' | 'SIGNAL' | 'END_OF_PERIOD';
  indicators?: {
    rsi?: number;
    macd?: { value: number; signal: number; histogram: number };
    trend?: string;
    volume?: number;
  };
}

export interface BacktestResult {
  config: BacktestConfig;
  trades: Trade[];
  metrics: BacktestMetrics;
  equity: EquityPoint[];
  analysis: StrategyAnalysis;
  timestamp: string;
}

export interface BacktestMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  totalReturn: number;
  totalReturnPercent: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  avgTradeDuration: number; // In hours
  avgRiskRewardRatio: number;
}

export interface EquityPoint {
  timestamp: string;
  equity: number;
  drawdown: number;
  drawdownPercent: number;
}

export interface StrategyAnalysis {
  bestTimeframes: Array<{ timeframe: string; winRate: number }>;
  bestRSILevels: Array<{ level: string; winRate: number; avgReturn: number }>;
  trendAlignment: {
    withTrend: { trades: number; winRate: number };
    againstTrend: { trades: number; winRate: number };
  };
  volumeAnalysis: {
    highVolume: { trades: number; winRate: number };
    lowVolume: { trades: number; winRate: number };
  };
  recommendations: string[];
}

export interface BacktestStorageRecord {
  id: string;
  strategyName: string;
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  winRate: number;
  totalReturn: number;
  profitFactor: number;
  totalTrades: number;
  result: string; // JSON stringified BacktestResult
  createdAt: string;
}
