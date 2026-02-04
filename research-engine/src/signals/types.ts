// Signal Types for MORPHEUS

export interface Token {
  symbol: string;
  address: string;
  name: string;
  decimals?: number;
}

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type SignalAction = 'LONG' | 'SHORT' | 'HOLD' | 'AVOID';
export type Timeframe = '1H' | '4H' | '1D' | '1W';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type Sentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface TechnicalAnalysis {
  rsi: {
    value: number;
    signal: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
  };
  macd: {
    macd: number;
    signal: number;
    histogram: number;
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    crossover?: 'BULLISH_CROSS' | 'BEARISH_CROSS' | null;
  };
  trend: {
    direction: 'UP' | 'DOWN' | 'SIDEWAYS';
    strength: number; // 0-100
    ema20: number;
    ema50: number;
    ema200: number;
  };
  support: number[];
  resistance: number[];
  momentum: {
    value: number;
    increasing: boolean;
  };
}

export interface FundamentalAnalysis {
  unlocks: TokenUnlock[];
  news: NewsItem[];
  sentiment: Sentiment;
  sentimentScore: number; // -100 to 100
}

export interface TokenUnlock {
  date: string;
  amount: number;
  percentOfSupply: number;
  recipientType: 'TEAM' | 'INVESTOR' | 'COMMUNITY' | 'ECOSYSTEM';
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface NewsItem {
  title: string;
  source: string;
  url: string;
  timestamp: string;
  sentiment: Sentiment;
}

export interface TradingSignal {
  id: string;
  timestamp: string;
  token: Token;
  action: SignalAction;
  entry: number;
  targets: number[];
  stopLoss: number;
  confidence: number; // 0-100
  timeframe: Timeframe;
  reasoning: {
    technical: string;
    fundamental: string;
    sentiment: string;
  };
  riskLevel: RiskLevel;
  technicalAnalysis?: TechnicalAnalysis;
  fundamentalAnalysis?: FundamentalAnalysis;
  indicators?: Record<string, number>;
}

export interface AnalystCall {
  id: string;
  analystId: string;
  token: Token;
  direction: 'LONG' | 'SHORT';
  entry: number;
  target: number;
  stopLoss: number;
  timeframe: string;
  submittedAt: string;
  outcome?: CallOutcome;
}

export interface CallOutcome {
  result: 'WIN' | 'LOSS' | 'NEUTRAL';
  exitPrice: number;
  exitTime: string;
  returnPercent: number;
}

export interface AnalystStats {
  analystId: string;
  name: string;
  totalCalls: number;
  wins: number;
  losses: number;
  neutral: number;
  winRate: number;
  avgReturn: number;
  profitFactor: number;
  rank: number;
  lastActive: string;
}

export interface MarketData {
  token: Token;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  ohlcv: {
    '1H': OHLCV[];
    '4H': OHLCV[];
    '1D': OHLCV[];
  };
  lastUpdated: string;
}
