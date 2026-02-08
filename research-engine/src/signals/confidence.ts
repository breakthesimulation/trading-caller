/**
 * Confidence Breakdown System
 * Transparent confidence scoring with factor contributions
 */

import type { TechnicalAnalysis } from './types.js';
import type { ConfidenceFactor, ConfidenceBreakdown } from '../fundamental/types.js';

/**
 * Calculate detailed confidence breakdown
 */
export function calculateConfidenceBreakdown(
  analysis4H: TechnicalAnalysis,
  analysis1D: TechnicalAnalysis,
  sentiment: number,
  fundamentalScore: number = 0,
  historicalData?: { winRate: number; sampleSize: number }
): ConfidenceBreakdown {
  const factors: ConfidenceFactor[] = [];
  
  // === RSI FACTORS ===
  
  // Extreme RSI levels
  if (analysis4H.rsi.value <= 20) {
    factors.push({
      name: 'Extreme Oversold RSI',
      category: 'TECHNICAL',
      weight: 20,
      value: 100,
      contribution: 20,
      description: `RSI(4H) = ${analysis4H.rsi.value.toFixed(1)} - Extreme oversold bounce zone`,
    });
  } else if (analysis4H.rsi.value >= 80) {
    factors.push({
      name: 'Extreme Overbought RSI',
      category: 'TECHNICAL',
      weight: 20,
      value: 100,
      contribution: 20,
      description: `RSI(4H) = ${analysis4H.rsi.value.toFixed(1)} - Extreme overbought reversal zone`,
    });
  } else if (analysis4H.rsi.signal === 'OVERSOLD' || analysis4H.rsi.signal === 'OVERBOUGHT') {
    factors.push({
      name: `${analysis4H.rsi.signal === 'OVERSOLD' ? 'Oversold' : 'Overbought'} RSI`,
      category: 'TECHNICAL',
      weight: 10,
      value: 75,
      contribution: 7.5,
      description: `RSI(4H) = ${analysis4H.rsi.value.toFixed(1)} - ${analysis4H.rsi.signal.toLowerCase()} territory`,
    });
  }
  
  // RSI Multi-timeframe alignment
  if (
    (analysis4H.rsi.signal === 'OVERSOLD' && analysis1D.rsi.signal === 'OVERSOLD') ||
    (analysis4H.rsi.signal === 'OVERBOUGHT' && analysis1D.rsi.signal === 'OVERBOUGHT')
  ) {
    factors.push({
      name: 'RSI Alignment',
      category: 'TECHNICAL',
      weight: 15,
      value: 100,
      contribution: 15,
      description: `Both 4H and 1D RSI showing ${analysis4H.rsi.signal.toLowerCase()}`,
    });
  } else if (
    (analysis4H.rsi.signal === 'OVERSOLD' && analysis1D.rsi.value < 40) ||
    (analysis4H.rsi.signal === 'OVERBOUGHT' && analysis1D.rsi.value > 60)
  ) {
    factors.push({
      name: 'Partial RSI Alignment',
      category: 'TECHNICAL',
      weight: 5,
      value: 50,
      contribution: 2.5,
      description: `4H RSI ${analysis4H.rsi.signal.toLowerCase()}, 1D supportive`,
    });
  }
  
  // === MACD FACTORS ===
  
  if (analysis4H.macd.crossover === 'BULLISH_CROSS' || analysis4H.macd.crossover === 'BEARISH_CROSS') {
    factors.push({
      name: 'MACD Crossover',
      category: 'TECHNICAL',
      weight: 10,
      value: 80,
      contribution: 8,
      description: `${analysis4H.macd.crossover} on 4H chart`,
    });
  }
  
  if (analysis4H.macd.trend === analysis1D.macd.trend && analysis4H.macd.trend !== 'NEUTRAL') {
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
  
  if (analysis4H.trend.direction === analysis1D.trend.direction && analysis4H.trend.direction !== 'SIDEWAYS') {
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
      description: fundamentalScore > 0 
        ? `Positive fundamentals (+${fundamentalScore.toFixed(0)})` 
        : `Negative fundamentals (${fundamentalScore.toFixed(0)})`,
    });
  }
  
  // === HISTORICAL FACTOR ===
  
  if (historicalData && historicalData.sampleSize >= 10) {
    const historicalValue = historicalData.winRate;
    factors.push({
      name: 'Historical Win Rate',
      category: 'HISTORICAL',
      weight: 12,
      value: historicalValue,
      contribution: (historicalValue / 100) * 12,
      description: `Similar setups: ${historicalValue.toFixed(0)}% win rate (${historicalData.sampleSize} trades)`,
    });
  }
  
  // Calculate total confidence
  const totalConfidence = Math.min(95, Math.max(25, 
    50 + factors.reduce((sum, f) => sum + f.contribution, 0)
  ));
  
  // Generate reasoning
  const topFactors = [...factors]
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3);
  
  const reasoning = `Confidence based on: ${topFactors.map(f => f.name).join(', ')}. ` +
    `Total ${factors.length} factors analyzed.`;
  
  return {
    totalConfidence: Math.round(totalConfidence),
    factors: factors.sort((a, b) => b.contribution - a.contribution),
    historicalWinRate: historicalData?.winRate || 0,
    similarSetups: historicalData?.sampleSize || 0,
    reasoning,
  };
}

/**
 * Get historical win rate for similar setups
 * (Mock implementation - in production, query from database)
 */
export function getHistoricalWinRate(
  action: 'LONG' | 'SHORT',
  rsiLevel: number,
  trendDirection: string,
  timeframe: string
): { winRate: number; sampleSize: number } {
  // Mock data - replace with actual database query
  
  // RSI-based win rates (simplified)
  let baseWinRate = 50;
  
  if (action === 'LONG') {
    if (rsiLevel <= 20) baseWinRate = 72;
    else if (rsiLevel <= 30) baseWinRate = 64;
    else if (rsiLevel <= 40) baseWinRate = 56;
  } else {
    if (rsiLevel >= 80) baseWinRate = 68;
    else if (rsiLevel >= 70) baseWinRate = 61;
    else if (rsiLevel >= 60) baseWinRate = 54;
  }
  
  // Adjust for trend alignment
  if (
    (action === 'LONG' && trendDirection === 'UP') ||
    (action === 'SHORT' && trendDirection === 'DOWN')
  ) {
    baseWinRate += 8;
  }
  
  // Mock sample size
  const sampleSize = Math.floor(20 + Math.random() * 80);
  
  return {
    winRate: Math.min(85, Math.max(40, baseWinRate)),
    sampleSize,
  };
}
