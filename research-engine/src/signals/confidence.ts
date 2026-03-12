/**
 * Confidence Breakdown System
 * Transparent confidence scoring tied to real confluence factors.
 * No mock data — only scores what we can actually measure.
 */

import type { TechnicalAnalysis } from './types.js';
import type { ConfidenceFactor, ConfidenceBreakdown } from '../fundamental/types.js';
import type { VolumeAnalysis } from '../technical/volume.js';

/**
 * Calculate detailed confidence breakdown from real indicators
 */
export function calculateConfidenceBreakdown(
  analysis4H: TechnicalAnalysis,
  analysis1D: TechnicalAnalysis,
  sentiment: number,
  volumeAnalysis?: VolumeAnalysis,
  fundamentalScore: number = 0,
): ConfidenceBreakdown {
  const factors: ConfidenceFactor[] = [];

  // === RSI FACTORS ===

  if (analysis4H.rsi.value <= 20) {
    factors.push({
      name: 'Extreme Oversold RSI',
      category: 'TECHNICAL',
      weight: 20,
      value: 100,
      contribution: 20,
      description: `RSI(4H) = ${analysis4H.rsi.value.toFixed(1)} — extreme oversold bounce zone`,
    });
  } else if (analysis4H.rsi.value >= 80) {
    factors.push({
      name: 'Extreme Overbought RSI',
      category: 'TECHNICAL',
      weight: 20,
      value: 100,
      contribution: 20,
      description: `RSI(4H) = ${analysis4H.rsi.value.toFixed(1)} — extreme overbought reversal zone`,
    });
  } else if (
    analysis4H.rsi.signal === 'OVERSOLD' ||
    analysis4H.rsi.signal === 'OVERBOUGHT'
  ) {
    factors.push({
      name: `${analysis4H.rsi.signal === 'OVERSOLD' ? 'Oversold' : 'Overbought'} RSI`,
      category: 'TECHNICAL',
      weight: 10,
      value: 75,
      contribution: 7.5,
      description: `RSI(4H) = ${analysis4H.rsi.value.toFixed(1)} — ${analysis4H.rsi.signal.toLowerCase()} territory`,
    });
  }

  // RSI multi-timeframe alignment
  if (
    (analysis4H.rsi.signal === 'OVERSOLD' &&
      analysis1D.rsi.signal === 'OVERSOLD') ||
    (analysis4H.rsi.signal === 'OVERBOUGHT' &&
      analysis1D.rsi.signal === 'OVERBOUGHT')
  ) {
    factors.push({
      name: 'RSI Alignment',
      category: 'TECHNICAL',
      weight: 15,
      value: 100,
      contribution: 15,
      description: `Both 4H and 1D RSI showing ${analysis4H.rsi.signal.toLowerCase()}`,
    });
  }

  // === MACD FACTORS ===

  if (
    analysis4H.macd.crossover === 'BULLISH_CROSS' ||
    analysis4H.macd.crossover === 'BEARISH_CROSS'
  ) {
    factors.push({
      name: 'MACD Crossover',
      category: 'TECHNICAL',
      weight: 10,
      value: 80,
      contribution: 8,
      description: `${analysis4H.macd.crossover} on 4H chart`,
    });
  }

  if (
    analysis4H.macd.trend === analysis1D.macd.trend &&
    analysis4H.macd.trend !== 'NEUTRAL'
  ) {
    factors.push({
      name: 'MACD Alignment',
      category: 'TECHNICAL',
      weight: 10,
      value: 75,
      contribution: 7.5,
      description: `Both timeframes showing ${analysis4H.macd.trend.toLowerCase()} MACD`,
    });
  }

  // === TREND FACTORS ===

  if (
    analysis4H.trend.direction === analysis1D.trend.direction &&
    analysis4H.trend.direction !== 'SIDEWAYS'
  ) {
    factors.push({
      name: 'Trend Alignment',
      category: 'TECHNICAL',
      weight: 15,
      value: 85,
      contribution: 12.75,
      description: `Strong ${analysis4H.trend.direction.toLowerCase()} trend on both timeframes`,
    });
  }

  if (analysis4H.trend.strength > 60) {
    factors.push({
      name: 'Strong Trend',
      category: 'TECHNICAL',
      weight: 8,
      value: analysis4H.trend.strength,
      contribution: (analysis4H.trend.strength / 100) * 8,
      description: `Trend strength: ${analysis4H.trend.strength.toFixed(0)}%`,
    });
  }

  // === VOLUME FACTORS (real data only) ===

  if (volumeAnalysis) {
    if (volumeAnalysis.volumeRatio >= 2.0) {
      factors.push({
        name: 'Volume Spike',
        category: 'TECHNICAL',
        weight: 12,
        value: 90,
        contribution: 10.8,
        description: `Volume ${volumeAnalysis.volumeRatio.toFixed(1)}x average — strong confirmation`,
      });
    } else if (volumeAnalysis.volumeRatio >= 1.2) {
      factors.push({
        name: 'Elevated Volume',
        category: 'TECHNICAL',
        weight: 8,
        value: 60,
        contribution: 4.8,
        description: `Volume ${volumeAnalysis.volumeRatio.toFixed(1)}x average — moderate confirmation`,
      });
    }

    if (volumeAnalysis.confirmation === 'DIVERGENCE') {
      factors.push({
        name: 'Volume Divergence Warning',
        category: 'TECHNICAL',
        weight: 10,
        value: -50,
        contribution: -5,
        description: 'Price and volume diverging — signal less reliable',
      });
    }
  }

  // === SENTIMENT FACTOR ===

  if (Math.abs(sentiment) > 20) {
    const sentimentValue = Math.min(100, Math.abs(sentiment) * 2);
    factors.push({
      name: 'Market Sentiment',
      category: 'SENTIMENT',
      weight: 10,
      value: sentimentValue,
      contribution: (sentimentValue / 100) * 10,
      description: `${sentiment > 0 ? 'Bullish' : 'Bearish'} sentiment (${sentiment.toFixed(0)})`,
    });
  }

  // === FUNDAMENTAL FACTOR ===

  if (fundamentalScore !== 0) {
    const absScore = Math.abs(fundamentalScore);
    factors.push({
      name: 'Fundamental Analysis',
      category: 'FUNDAMENTAL',
      weight: 15,
      value: absScore,
      contribution: (absScore / 100) * 15,
      description:
        fundamentalScore > 0
          ? `Positive fundamentals (+${fundamentalScore.toFixed(0)})`
          : `Negative fundamentals (${fundamentalScore.toFixed(0)})`,
    });
  }

  // Calculate total confidence
  const totalConfidence = Math.min(
    95,
    Math.max(25, 50 + factors.reduce((sum, f) => sum + f.contribution, 0)),
  );

  // Generate reasoning from top factors
  const topFactors = [...factors]
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3);

  const reasoning =
    `Confidence based on: ${topFactors.map((f) => f.name).join(', ')}. ` +
    `Total ${factors.length} factors analyzed.`;

  return {
    totalConfidence: Math.round(totalConfidence),
    factors: factors.sort((a, b) => b.contribution - a.contribution),
    historicalWinRate: 0, // Real win rate populated by learning system
    similarSetups: 0,
    reasoning,
  };
}
