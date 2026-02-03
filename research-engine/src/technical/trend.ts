// Trend Detection and Moving Averages

import type { OHLCV } from '../signals/types.js';

export interface TrendResult {
  direction: 'UP' | 'DOWN' | 'SIDEWAYS';
  strength: number; // 0-100
  ema20: number;
  ema50: number;
  ema200: number;
  priceVsEMA: {
    above20: boolean;
    above50: boolean;
    above200: boolean;
  };
  emaAlignment: 'BULLISH' | 'BEARISH' | 'MIXED';
}

/**
 * Calculate Simple Moving Average
 */
export function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) {
    return prices.reduce((a, b) => a + b, 0) / prices.length;
  }
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * Calculate Exponential Moving Average (single value)
 */
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  if (prices.length < period) {
    return prices.reduce((a, b) => a + b, 0) / prices.length;
  }

  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }

  return ema;
}

/**
 * Calculate all EMAs for trend analysis
 */
export function calculateTrendEMAs(prices: number[]): {
  ema20: number;
  ema50: number;
  ema200: number;
} {
  return {
    ema20: Math.round(calculateEMA(prices, 20) * 100) / 100,
    ema50: Math.round(calculateEMA(prices, 50) * 100) / 100,
    ema200: Math.round(calculateEMA(prices, 200) * 100) / 100,
  };
}

/**
 * Detect trend direction and strength
 */
export function detectTrend(ohlcv: OHLCV[]): TrendResult {
  if (ohlcv.length < 20) {
    return {
      direction: 'SIDEWAYS',
      strength: 0,
      ema20: 0,
      ema50: 0,
      ema200: 0,
      priceVsEMA: { above20: false, above50: false, above200: false },
      emaAlignment: 'MIXED',
    };
  }

  const closes = ohlcv.map(c => c.close);
  const currentPrice = closes[closes.length - 1];
  const { ema20, ema50, ema200 } = calculateTrendEMAs(closes);

  // Price vs EMA
  const above20 = currentPrice > ema20;
  const above50 = currentPrice > ema50;
  const above200 = currentPrice > ema200;

  // EMA alignment
  let emaAlignment: 'BULLISH' | 'BEARISH' | 'MIXED';
  if (ema20 > ema50 && ema50 > ema200) {
    emaAlignment = 'BULLISH';
  } else if (ema20 < ema50 && ema50 < ema200) {
    emaAlignment = 'BEARISH';
  } else {
    emaAlignment = 'MIXED';
  }

  // Calculate trend direction based on recent price action
  const recentPrices = closes.slice(-20);
  const priceChange = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0];
  
  // Calculate price volatility
  const returns = [];
  for (let i = 1; i < recentPrices.length; i++) {
    returns.push((recentPrices[i] - recentPrices[i - 1]) / recentPrices[i - 1]);
  }
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance);

  // Determine direction
  let direction: 'UP' | 'DOWN' | 'SIDEWAYS';
  const trendThreshold = volatility * 2; // Dynamic threshold based on volatility

  if (priceChange > trendThreshold) {
    direction = 'UP';
  } else if (priceChange < -trendThreshold) {
    direction = 'DOWN';
  } else {
    direction = 'SIDEWAYS';
  }

  // Calculate strength (0-100)
  let strength: number;
  const absPriceChange = Math.abs(priceChange);
  
  if (direction === 'SIDEWAYS') {
    strength = 0;
  } else {
    // Strength based on price change magnitude and EMA alignment
    strength = Math.min(100, Math.round(absPriceChange * 500));
    
    // Bonus for EMA alignment
    if ((direction === 'UP' && emaAlignment === 'BULLISH') ||
        (direction === 'DOWN' && emaAlignment === 'BEARISH')) {
      strength = Math.min(100, strength + 20);
    }
    
    // Bonus for price above/below all EMAs
    if ((direction === 'UP' && above20 && above50 && above200) ||
        (direction === 'DOWN' && !above20 && !above50 && !above200)) {
      strength = Math.min(100, strength + 15);
    }
  }

  return {
    direction,
    strength,
    ema20,
    ema50,
    ema200,
    priceVsEMA: { above20, above50, above200 },
    emaAlignment,
  };
}

/**
 * Get trend analysis summary
 */
export function getTrendAnalysis(ohlcv: OHLCV[]): {
  trend: TrendResult;
  description: string;
} {
  const trend = detectTrend(ohlcv);
  const currentPrice = ohlcv[ohlcv.length - 1]?.close || 0;

  let description: string;

  if (trend.direction === 'UP') {
    description = `Uptrend detected (strength ${trend.strength}/100)`;
  } else if (trend.direction === 'DOWN') {
    description = `Downtrend detected (strength ${trend.strength}/100)`;
  } else {
    description = 'Sideways/consolidation phase';
  }

  // Add EMA context
  if (trend.emaAlignment === 'BULLISH') {
    description += '. EMAs bullishly aligned (20 > 50 > 200)';
  } else if (trend.emaAlignment === 'BEARISH') {
    description += '. EMAs bearishly aligned (20 < 50 < 200)';
  }

  // Add price position
  const emaCount = [trend.priceVsEMA.above20, trend.priceVsEMA.above50, trend.priceVsEMA.above200].filter(Boolean).length;
  description += `. Price above ${emaCount}/3 key EMAs`;

  return { trend, description };
}
