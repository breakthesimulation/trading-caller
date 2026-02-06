// Types for RSI oversold/overbought scanning

export interface RSIReading {
  symbol: string;
  address: string;
  name: string;
  rsi: number;
  signal: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
  price: number;
  priceChange24h?: number;
  volume24h?: number;
  lastUpdated: string;
  source: 'internal' | 'oversold.lol';
}

export interface OversoldScanResult {
  oversold: RSIReading[];
  overbought: RSIReading[];
  neutral: RSIReading[];
  scanTime: string;
  tokensScanned: number;
  source: 'internal' | 'oversold.lol';
}

export interface RSIThresholds {
  oversold: number;  // Default: 30
  overbought: number; // Default: 70
  extremeOversold: number;  // Default: 20
  extremeOverbought: number; // Default: 80
}

export interface OversoldLolResponse {
  // Placeholder for when/if API becomes available
  symbol: string;
  rsi: number;
  timeframe: string;
  lastUpdated: string;
}

export interface RSISignalStrength {
  symbol: string;
  rsiValue: number;
  signalType: 'OVERSOLD' | 'OVERBOUGHT';
  strength: 'EXTREME' | 'MODERATE' | 'WEAK';
  suggestedAction: 'LONG' | 'SHORT';
  confidenceBoost: number; // 0-20 points to add to signal confidence
}

export const DEFAULT_THRESHOLDS: RSIThresholds = {
  oversold: 30,
  overbought: 70,
  extremeOversold: 20,
  extremeOverbought: 80,
};
