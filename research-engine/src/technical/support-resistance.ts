// Support and Resistance Level Detection

import type { OHLCV } from '../signals/types.js';

export interface SupportResistanceResult {
  support: number[];
  resistance: number[];
  nearestSupport: number | null;
  nearestResistance: number | null;
  currentPrice: number;
  pricePosition: 'NEAR_SUPPORT' | 'NEAR_RESISTANCE' | 'MID_RANGE';
}

interface PivotPoint {
  price: number;
  type: 'HIGH' | 'LOW';
  strength: number;
  index: number;
}

/**
 * Find pivot points (local highs and lows)
 */
function findPivotPoints(ohlcv: OHLCV[], lookback: number = 5): PivotPoint[] {
  const pivots: PivotPoint[] = [];

  for (let i = lookback; i < ohlcv.length - lookback; i++) {
    const current = ohlcv[i];
    let isHigh = true;
    let isLow = true;

    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (ohlcv[j].high >= current.high) isHigh = false;
      if (ohlcv[j].low <= current.low) isLow = false;
    }

    if (isHigh) {
      pivots.push({
        price: current.high,
        type: 'HIGH',
        strength: 1,
        index: i,
      });
    }

    if (isLow) {
      pivots.push({
        price: current.low,
        type: 'LOW',
        strength: 1,
        index: i,
      });
    }
  }

  return pivots;
}

/**
 * Cluster nearby price levels
 */
function clusterLevels(prices: number[], threshold: number = 0.02): number[] {
  if (prices.length === 0) return [];

  const sorted = [...prices].sort((a, b) => a - b);
  const clusters: number[][] = [];
  let currentCluster: number[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prevPrice = currentCluster[currentCluster.length - 1];
    const priceDiff = (sorted[i] - prevPrice) / prevPrice;

    if (priceDiff <= threshold) {
      currentCluster.push(sorted[i]);
    } else {
      clusters.push(currentCluster);
      currentCluster = [sorted[i]];
    }
  }
  clusters.push(currentCluster);

  // Return average of each cluster, weighted by cluster size
  return clusters
    .filter(c => c.length >= 1)
    .map(cluster => {
      const sum = cluster.reduce((a, b) => a + b, 0);
      return Math.round((sum / cluster.length) * 100) / 100;
    })
    .sort((a, b) => a - b);
}

/**
 * Calculate support and resistance levels
 */
export function calculateSupportResistance(
  ohlcv: OHLCV[],
  lookback: number = 5,
  clusterThreshold: number = 0.02
): SupportResistanceResult {
  if (ohlcv.length < lookback * 2 + 1) {
    return {
      support: [],
      resistance: [],
      nearestSupport: null,
      nearestResistance: null,
      currentPrice: ohlcv[ohlcv.length - 1]?.close || 0,
      pricePosition: 'MID_RANGE',
    };
  }

  const currentPrice = ohlcv[ohlcv.length - 1].close;
  const pivots = findPivotPoints(ohlcv, lookback);

  // Separate highs and lows
  const highs = pivots.filter(p => p.type === 'HIGH').map(p => p.price);
  const lows = pivots.filter(p => p.type === 'LOW').map(p => p.price);

  // Add recent significant price levels
  const recentHigh = Math.max(...ohlcv.slice(-20).map(c => c.high));
  const recentLow = Math.min(...ohlcv.slice(-20).map(c => c.low));
  highs.push(recentHigh);
  lows.push(recentLow);

  // Cluster levels
  const allLevels = clusterLevels([...highs, ...lows], clusterThreshold);

  // Separate into support (below price) and resistance (above price)
  const support = allLevels.filter(level => level < currentPrice);
  const resistance = allLevels.filter(level => level > currentPrice);

  // Find nearest levels
  const nearestSupport = support.length > 0 ? Math.max(...support) : null;
  const nearestResistance = resistance.length > 0 ? Math.min(...resistance) : null;

  // Determine price position
  let pricePosition: 'NEAR_SUPPORT' | 'NEAR_RESISTANCE' | 'MID_RANGE' = 'MID_RANGE';
  
  if (nearestSupport && nearestResistance) {
    const distToSupport = (currentPrice - nearestSupport) / currentPrice;
    const distToResistance = (nearestResistance - currentPrice) / currentPrice;

    if (distToSupport < 0.02) {
      pricePosition = 'NEAR_SUPPORT';
    } else if (distToResistance < 0.02) {
      pricePosition = 'NEAR_RESISTANCE';
    }
  }

  return {
    support: support.slice(-5), // Keep top 5 support levels
    resistance: resistance.slice(0, 5), // Keep bottom 5 resistance levels
    nearestSupport,
    nearestResistance,
    currentPrice,
    pricePosition,
  };
}

/**
 * Get support/resistance analysis summary
 */
export function getSupportResistanceAnalysis(ohlcv: OHLCV[]): {
  levels: SupportResistanceResult;
  description: string;
} {
  const levels = calculateSupportResistance(ohlcv);

  let description: string;

  if (levels.pricePosition === 'NEAR_SUPPORT') {
    description = `Price at $${levels.currentPrice} is near support at $${levels.nearestSupport}`;
    if (levels.nearestResistance) {
      description += ` — resistance at $${levels.nearestResistance}`;
    }
  } else if (levels.pricePosition === 'NEAR_RESISTANCE') {
    description = `Price at $${levels.currentPrice} is near resistance at $${levels.nearestResistance}`;
    if (levels.nearestSupport) {
      description += ` — support at $${levels.nearestSupport}`;
    }
  } else {
    description = `Price at $${levels.currentPrice} is mid-range`;
    if (levels.nearestSupport && levels.nearestResistance) {
      description += ` between support $${levels.nearestSupport} and resistance $${levels.nearestResistance}`;
    }
  }

  return { levels, description };
}
