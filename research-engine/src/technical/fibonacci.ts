/**
 * Fibonacci Retracement & Extension Levels
 * Calculate key Fibonacci levels for support/resistance
 */

import type { OHLCV } from '../signals/types.js';

export interface FibonacciLevels {
  swing: {
    high: number;
    low: number;
    range: number;
  };
  retracement: {
    level_236: number;
    level_382: number;
    level_500: number;
    level_618: number;
    level_786: number;
  };
  extension: {
    level_1272: number;
    level_1414: number;
    level_1618: number;
  };
  current: {
    price: number;
    nearestLevel: number;
    levelName: string;
    distancePercent: number;
  };
}

/**
 * Calculate Fibonacci levels based on recent swing
 */
export function calculateFibonacciLevels(ohlcv: OHLCV[], lookback: number = 50): FibonacciLevels | null {
  if (ohlcv.length < lookback) {
    return null;
  }
  
  const recentData = ohlcv.slice(-lookback);
  
  // Find swing high and low
  const high = Math.max(...recentData.map(c => c.high));
  const low = Math.min(...recentData.map(c => c.low));
  const range = high - low;
  const currentPrice = ohlcv[ohlcv.length - 1].close;
  
  // Calculate retracement levels (from high to low)
  const retracement = {
    level_236: high - (range * 0.236),
    level_382: high - (range * 0.382),
    level_500: high - (range * 0.500),
    level_618: high - (range * 0.618),
    level_786: high - (range * 0.786),
  };
  
  // Calculate extension levels (beyond the range)
  const extension = {
    level_1272: high + (range * 0.272),
    level_1414: high + (range * 0.414),
    level_1618: high + (range * 0.618),
  };
  
  // Find nearest level
  const allLevels = {
    ...retracement,
    ...extension,
    level_000: high,
    level_1000: low,
  };
  
  let nearestLevel = high;
  let nearestLevelName = '0%';
  let minDistance = Infinity;
  
  for (const [name, level] of Object.entries(allLevels)) {
    const distance = Math.abs(currentPrice - level);
    if (distance < minDistance) {
      minDistance = distance;
      nearestLevel = level;
      nearestLevelName = name.replace('level_', '').replace('_', '.');
    }
  }
  
  const distancePercent = ((currentPrice - nearestLevel) / nearestLevel) * 100;
  
  return {
    swing: {
      high,
      low,
      range,
    },
    retracement,
    extension,
    current: {
      price: currentPrice,
      nearestLevel,
      levelName: nearestLevelName,
      distancePercent,
    },
  };
}

/**
 * Check if current price is near a Fibonacci level
 */
export function isNearFibLevel(fibLevels: FibonacciLevels, threshold: number = 2): {
  isNear: boolean;
  level: string;
  distance: number;
} {
  const distance = Math.abs(fibLevels.current.distancePercent);
  
  return {
    isNear: distance <= threshold,
    level: fibLevels.current.levelName,
    distance: fibLevels.current.distancePercent,
  };
}

/**
 * Get Fibonacci support/resistance description
 */
export function getFibDescription(fibLevels: FibonacciLevels): string {
  const { current, retracement } = fibLevels;
  
  // Check if near key level
  const nearCheck = isNearFibLevel(fibLevels, 2);
  
  if (nearCheck.isNear) {
    return `Near Fib ${nearCheck.level} level (${nearCheck.distance > 0 ? '+' : ''}${nearCheck.distance.toFixed(1)}%)`;
  }
  
  // Find position in range
  if (current.price >= retracement.level_236) {
    return `Above Fib 23.6% retracement - strong uptrend`;
  } else if (current.price >= retracement.level_382) {
    return `Between Fib 23.6-38.2% - healthy pullback`;
  } else if (current.price >= retracement.level_500) {
    return `At Fib 50% retracement - key decision zone`;
  } else if (current.price >= retracement.level_618) {
    return `At Fib 61.8% golden ratio - critical support`;
  } else {
    return `Below Fib 61.8% - deep retracement`;
  }
}
