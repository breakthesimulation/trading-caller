/**
 * Shared type definitions for the Trading Caller ElizaOS agent.
 * These types map directly to the Trading Caller API response shapes.
 */

/**
 * A signal as returned by the Trading Caller API (GET /signals/latest).
 * Maps directly to the API response shape -- do NOT change field names.
 */
export interface TradingSignal {
  id: string;
  timestamp: string;
  token: {
    symbol: string;
    name: string;
    address: string; // Solana mint address
    decimals: number;
  };
  action: 'LONG' | 'SHORT';
  entry: number;
  targets: [number, number, number]; // TP1, TP2, TP3
  stopLoss: number;
  confidence: number; // 0-100
  timeframe: string; // "4H", "1D", etc.
  reasoning: {
    technical: string;
    fundamental: string;
    sentiment: string;
  };
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  technicalAnalysis: {
    rsi: { value: number; signal: string };
    macd: {
      macd: number;
      signal: number;
      histogram: number;
      trend: string;
      crossover: string | null;
    };
    trend: {
      direction: string;
      strength: number;
      ema20: number;
      ema50: number;
      ema200: number;
    };
    support: number[];
    resistance: number[];
    momentum: { value: number; increasing: boolean };
  };
  indicators: Record<string, number>;
}

/** Internal trade record tracked by the agent */
export interface TradeRecord {
  id: string;
  signalId: string;
  signal: TradingSignal;
  mode: 'paper' | 'live';
  entryPrice: number;
  exitPrice?: number;
  entryTxHash?: string; // Only set in live mode
  exitTxHash?: string;
  positionSizeUSD: number;
  positionSizeTokens: number;
  pnl?: number;
  pnlPercent?: number;
  status: 'open' | 'closed' | 'stopped_out' | 'tp1_hit' | 'tp2_hit' | 'tp3_hit';
  entryTimestamp: number;
  exitTimestamp?: number;
}

/** Self-learning strategy parameters, adjusted by LLM review */
export interface StrategyConfig {
  /** Min signal confidence to trade (default: 60) */
  minConfidence: number;
  /** Percentage of portfolio per trade (default: 5) */
  defaultPositionPct: number;
  /** Percentage for confidence > 80 (default: 8) */
  highConfidencePositionPct: number;
  /** Concurrent position limit (default: 5) */
  maxOpenPositions: number;
  /** Max percentage of portfolio in trades (default: 40) */
  maxPortfolioExposurePct: number;
  /** Halt threshold (default: 15) */
  maxDrawdownPct: number;
  /** Pause after N consecutive losses (default: 3) */
  coolOffAfterConsecutiveLosses: number;
  /** Cool-off duration in milliseconds (default: 3600000) */
  coolOffDurationMs: number;
  lastUpdated: number;
  updateReason: string;
  version: number;
}

/** Response shape from GET /signals/latest */
export interface SignalsApiResponse {
  success: boolean;
  count: number;
  signals: TradingSignal[];
  lastUpdate: string;
}

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  minConfidence: 60,
  defaultPositionPct: 5,
  highConfidencePositionPct: 8,
  maxOpenPositions: 5,
  maxPortfolioExposurePct: 40,
  maxDrawdownPct: 15,
  coolOffAfterConsecutiveLosses: 3,
  coolOffDurationMs: 3_600_000,
  lastUpdated: Date.now(),
  updateReason: 'Initial defaults',
  version: 1,
};
