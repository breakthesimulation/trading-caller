// RSI (Relative Strength Index) Calculator

import type { OHLCV } from '../signals/types.js';

export interface RSIResult {
  value: number;
  signal: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
  values: number[]; // Historical RSI values
}

/**
 * Calculate RSI using standard Wilder's smoothing method
 * @param prices Array of closing prices (oldest first)
 * @param period RSI period (default 14)
 * @returns RSI result with value, signal, and historical values
 */
export function calculateRSI(prices: number[], period: number = 14): RSIResult {
  if (prices.length < period + 1) {
    return { value: 50, signal: 'NEUTRAL', values: [] };
  }

  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  const gains: number[] = changes.map(c => (c > 0 ? c : 0));
  const losses: number[] = changes.map(c => (c < 0 ? Math.abs(c) : 0));

  // Calculate initial average gain/loss
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  const rsiValues: number[] = [];

  // Calculate RSI for each period using Wilder's smoothing
  for (let i = period; i < changes.length; i++) {
    if (i > period) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);
    rsiValues.push(rsi);
  }

  const currentRSI = rsiValues[rsiValues.length - 1] || 50;
  
  let signal: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
  if (currentRSI <= 30) {
    signal = 'OVERSOLD';
  } else if (currentRSI >= 70) {
    signal = 'OVERBOUGHT';
  } else {
    signal = 'NEUTRAL';
  }

  return {
    value: Math.round(currentRSI * 100) / 100,
    signal,
    values: rsiValues,
  };
}

/**
 * Calculate RSI from OHLCV data
 */
export function calculateRSIFromOHLCV(ohlcv: OHLCV[], period: number = 14): RSIResult {
  const closes = ohlcv.map(candle => candle.close);
  return calculateRSI(closes, period);
}

/**
 * Detect RSI divergence (bullish or bearish)
 * @param prices Price array
 * @param rsiValues RSI values array
 * @param lookback Number of candles to look back
 * @returns Divergence type or null
 */
export function detectRSIDivergence(
  prices: number[],
  rsiValues: number[],
  lookback: number = 10
): 'BULLISH' | 'BEARISH' | null {
  if (prices.length < lookback || rsiValues.length < lookback) {
    return null;
  }

  const recentPrices = prices.slice(-lookback);
  const recentRSI = rsiValues.slice(-lookback);

  // Find local lows and highs
  const priceLow1 = Math.min(...recentPrices.slice(0, lookback / 2));
  const priceLow2 = Math.min(...recentPrices.slice(lookback / 2));
  const rsiLow1 = Math.min(...recentRSI.slice(0, lookback / 2));
  const rsiLow2 = Math.min(...recentRSI.slice(lookback / 2));

  const priceHigh1 = Math.max(...recentPrices.slice(0, lookback / 2));
  const priceHigh2 = Math.max(...recentPrices.slice(lookback / 2));
  const rsiHigh1 = Math.max(...recentRSI.slice(0, lookback / 2));
  const rsiHigh2 = Math.max(...recentRSI.slice(lookback / 2));

  // Bullish divergence: price makes lower low, RSI makes higher low
  if (priceLow2 < priceLow1 && rsiLow2 > rsiLow1 && rsiLow2 < 40) {
    return 'BULLISH';
  }

  // Bearish divergence: price makes higher high, RSI makes lower high
  if (priceHigh2 > priceHigh1 && rsiHigh2 < rsiHigh1 && rsiHigh2 > 60) {
    return 'BEARISH';
  }

  return null;
}

/**
 * Get RSI analysis summary
 */
export function getRSIAnalysis(ohlcv: OHLCV[], period: number = 14): {
  rsi: RSIResult;
  divergence: 'BULLISH' | 'BEARISH' | null;
  description: string;
} {
  const rsi = calculateRSIFromOHLCV(ohlcv, period);
  const prices = ohlcv.map(c => c.close);
  const divergence = detectRSIDivergence(prices, rsi.values);

  let description: string;
  
  if (rsi.signal === 'OVERSOLD') {
    description = `RSI at ${rsi.value} indicates oversold conditions`;
    if (divergence === 'BULLISH') {
      description += ' with bullish divergence forming — potential reversal signal';
    } else {
      description += ' — watch for bounce or continued weakness';
    }
  } else if (rsi.signal === 'OVERBOUGHT') {
    description = `RSI at ${rsi.value} indicates overbought conditions`;
    if (divergence === 'BEARISH') {
      description += ' with bearish divergence forming — potential reversal signal';
    } else {
      description += ' — watch for pullback or momentum continuation';
    }
  } else {
    description = `RSI at ${rsi.value} is neutral`;
    if (rsi.value > 50) {
      description += ' with slight bullish bias';
    } else if (rsi.value < 50) {
      description += ' with slight bearish bias';
    }
  }

  return { rsi, divergence, description };
}
