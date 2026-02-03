// MACD (Moving Average Convergence Divergence) Calculator

import type { OHLCV } from '../signals/types.js';

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  crossover: 'BULLISH_CROSS' | 'BEARISH_CROSS' | null;
  values: {
    macd: number[];
    signal: number[];
    histogram: number[];
  };
}

/**
 * Calculate Exponential Moving Average
 */
function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  // Start with SMA for first value
  let sum = 0;
  for (let i = 0; i < period && i < prices.length; i++) {
    sum += prices[i];
  }
  ema.push(sum / Math.min(period, prices.length));

  // Calculate EMA for remaining values
  for (let i = period; i < prices.length; i++) {
    const value = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(value);
  }

  return ema;
}

/**
 * Calculate MACD
 * @param prices Array of closing prices
 * @param fastPeriod Fast EMA period (default 12)
 * @param slowPeriod Slow EMA period (default 26)
 * @param signalPeriod Signal line period (default 9)
 */
export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  if (prices.length < slowPeriod + signalPeriod) {
    return {
      macd: 0,
      signal: 0,
      histogram: 0,
      trend: 'NEUTRAL',
      crossover: null,
      values: { macd: [], signal: [], histogram: [] },
    };
  }

  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);

  // Calculate MACD line (fast EMA - slow EMA)
  const macdLine: number[] = [];
  const offset = slowPeriod - fastPeriod;
  
  for (let i = 0; i < slowEMA.length; i++) {
    const fastIndex = i + offset;
    if (fastIndex < fastEMA.length) {
      macdLine.push(fastEMA[fastIndex] - slowEMA[i]);
    }
  }

  // Calculate signal line (EMA of MACD)
  const signalLine = calculateEMA(macdLine, signalPeriod);

  // Calculate histogram
  const histogram: number[] = [];
  const signalOffset = macdLine.length - signalLine.length;
  
  for (let i = 0; i < signalLine.length; i++) {
    histogram.push(macdLine[i + signalOffset] - signalLine[i]);
  }

  const currentMACD = macdLine[macdLine.length - 1] || 0;
  const currentSignal = signalLine[signalLine.length - 1] || 0;
  const currentHistogram = histogram[histogram.length - 1] || 0;
  const prevHistogram = histogram[histogram.length - 2] || 0;

  // Determine trend
  let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  if (currentHistogram > 0 && currentHistogram > prevHistogram) {
    trend = 'BULLISH';
  } else if (currentHistogram < 0 && currentHistogram < prevHistogram) {
    trend = 'BEARISH';
  } else {
    trend = 'NEUTRAL';
  }

  // Detect crossover
  let crossover: 'BULLISH_CROSS' | 'BEARISH_CROSS' | null = null;
  if (histogram.length >= 2) {
    if (prevHistogram < 0 && currentHistogram > 0) {
      crossover = 'BULLISH_CROSS';
    } else if (prevHistogram > 0 && currentHistogram < 0) {
      crossover = 'BEARISH_CROSS';
    }
  }

  return {
    macd: Math.round(currentMACD * 10000) / 10000,
    signal: Math.round(currentSignal * 10000) / 10000,
    histogram: Math.round(currentHistogram * 10000) / 10000,
    trend,
    crossover,
    values: {
      macd: macdLine,
      signal: signalLine,
      histogram,
    },
  };
}

/**
 * Calculate MACD from OHLCV data
 */
export function calculateMACDFromOHLCV(
  ohlcv: OHLCV[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  const closes = ohlcv.map(candle => candle.close);
  return calculateMACD(closes, fastPeriod, slowPeriod, signalPeriod);
}

/**
 * Get MACD analysis summary
 */
export function getMACDAnalysis(ohlcv: OHLCV[]): {
  macd: MACDResult;
  description: string;
} {
  const macd = calculateMACDFromOHLCV(ohlcv);

  let description: string;

  if (macd.crossover === 'BULLISH_CROSS') {
    description = 'MACD bullish crossover detected — potential buy signal';
  } else if (macd.crossover === 'BEARISH_CROSS') {
    description = 'MACD bearish crossover detected — potential sell signal';
  } else if (macd.trend === 'BULLISH') {
    description = `MACD bullish with histogram at ${macd.histogram} — momentum increasing`;
  } else if (macd.trend === 'BEARISH') {
    description = `MACD bearish with histogram at ${macd.histogram} — momentum decreasing`;
  } else {
    description = 'MACD neutral — no clear momentum direction';
  }

  return { macd, description };
}
