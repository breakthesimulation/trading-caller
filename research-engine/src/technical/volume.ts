/**
 * Volume Analysis
 * Confirms price movements with volume trends
 */

import type { OHLCV } from '../signals/types.js';

export interface VolumeAnalysis {
  avgVolume: number;
  currentVolume: number;
  volumeRatio: number; // current / average
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  confirmation: 'STRONG' | 'MODERATE' | 'WEAK' | 'DIVERGENCE';
  description: string;
}

/**
 * Analyze volume patterns
 */
export function analyzeVolume(ohlcv: OHLCV[], lookback: number = 20): VolumeAnalysis {
  if (ohlcv.length < 2) {
    return {
      avgVolume: 0,
      currentVolume: 0,
      volumeRatio: 1,
      trend: 'STABLE',
      confirmation: 'WEAK',
      description: 'Insufficient data',
    };
  }
  
  const volumes = ohlcv.slice(-lookback).map(c => c.volume);
  const currentVolume = volumes[volumes.length - 1];
  const avgVolume = volumes.slice(0, -1).reduce((sum, v) => sum + v, 0) / (volumes.length - 1);
  const volumeRatio = currentVolume / avgVolume;
  
  // Determine trend
  const recentVolumes = volumes.slice(-5);
  const olderVolumes = volumes.slice(-10, -5);
  const recentAvg = recentVolumes.reduce((sum, v) => sum + v, 0) / recentVolumes.length;
  const olderAvg = olderVolumes.reduce((sum, v) => sum + v, 0) / olderVolumes.length;
  
  let trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  if (recentAvg > olderAvg * 1.2) {
    trend = 'INCREASING';
  } else if (recentAvg < olderAvg * 0.8) {
    trend = 'DECREASING';
  } else {
    trend = 'STABLE';
  }
  
  // Determine confirmation strength
  let confirmation: 'STRONG' | 'MODERATE' | 'WEAK' | 'DIVERGENCE';
  let description = '';
  
  // Price direction
  const priceChange = ((ohlcv[ohlcv.length - 1].close - ohlcv[ohlcv.length - 2].close) / ohlcv[ohlcv.length - 2].close) * 100;
  const isPriceUp = priceChange > 0;
  const isVolumeUp = volumeRatio > 1;
  
  if (isPriceUp && isVolumeUp) {
    if (volumeRatio > 2) {
      confirmation = 'STRONG';
      description = `Strong bullish confirmation - volume spike ${volumeRatio.toFixed(1)}x average`;
    } else if (volumeRatio > 1.5) {
      confirmation = 'STRONG';
      description = `Bullish confirmation - volume ${volumeRatio.toFixed(1)}x average`;
    } else {
      confirmation = 'MODERATE';
      description = `Moderate bullish confirmation - volume slightly elevated`;
    }
  } else if (!isPriceUp && isVolumeUp) {
    if (volumeRatio > 2) {
      confirmation = 'STRONG';
      description = `Strong bearish confirmation - volume spike ${volumeRatio.toFixed(1)}x on selling`;
    } else if (volumeRatio > 1.5) {
      confirmation = 'STRONG';
      description = `Bearish confirmation - volume ${volumeRatio.toFixed(1)}x on selling`;
    } else {
      confirmation = 'MODERATE';
      description = `Moderate bearish confirmation`;
    }
  } else if (isPriceUp && !isVolumeUp) {
    confirmation = 'DIVERGENCE';
    description = `⚠️ Bearish divergence - price up but volume declining`;
  } else if (!isPriceUp && !isVolumeUp) {
    confirmation = 'WEAK';
    description = `Weak signal - low volume decline`;
  } else {
    confirmation = 'MODERATE';
    description = `Moderate confirmation`;
  }
  
  return {
    avgVolume,
    currentVolume,
    volumeRatio,
    trend,
    confirmation,
    description,
  };
}

/**
 * Calculate volume score for confidence adjustment
 * Returns -20 to +20
 */
export function calculateVolumeScore(volumeAnalysis: VolumeAnalysis, action: 'LONG' | 'SHORT'): number {
  const { confirmation, volumeRatio, trend } = volumeAnalysis;
  
  let score = 0;
  
  // Base score from confirmation
  if (confirmation === 'STRONG') {
    score = 15;
  } else if (confirmation === 'MODERATE') {
    score = 8;
  } else if (confirmation === 'WEAK') {
    score = 2;
  } else if (confirmation === 'DIVERGENCE') {
    score = -10;
  }
  
  // Adjust for volume ratio
  if (volumeRatio > 2) {
    score += 5;
  } else if (volumeRatio < 0.5) {
    score -= 5;
  }
  
  // Adjust for trend
  if (trend === 'INCREASING' && action === 'LONG') {
    score += 3;
  } else if (trend === 'DECREASING' && action === 'SHORT') {
    score += 3;
  }
  
  return Math.min(20, Math.max(-20, score));
}
