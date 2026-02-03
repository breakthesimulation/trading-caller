// Technical Analysis Module - Exports

export * from './rsi.js';
export * from './macd.js';
export * from './support-resistance.js';
export * from './trend.js';

import type { OHLCV, TechnicalAnalysis } from '../signals/types.js';
import { getRSIAnalysis } from './rsi.js';
import { getMACDAnalysis } from './macd.js';
import { getSupportResistanceAnalysis } from './support-resistance.js';
import { getTrendAnalysis } from './trend.js';

/**
 * Run complete technical analysis on OHLCV data
 */
export function runTechnicalAnalysis(ohlcv: OHLCV[]): {
  analysis: TechnicalAnalysis;
  summary: string;
} {
  const rsiResult = getRSIAnalysis(ohlcv);
  const macdResult = getMACDAnalysis(ohlcv);
  const srResult = getSupportResistanceAnalysis(ohlcv);
  const trendResult = getTrendAnalysis(ohlcv);

  const analysis: TechnicalAnalysis = {
    rsi: {
      value: rsiResult.rsi.value,
      signal: rsiResult.rsi.signal,
    },
    macd: {
      macd: macdResult.macd.macd,
      signal: macdResult.macd.signal,
      histogram: macdResult.macd.histogram,
      trend: macdResult.macd.trend,
      crossover: macdResult.macd.crossover,
    },
    trend: {
      direction: trendResult.trend.direction,
      strength: trendResult.trend.strength,
      ema20: trendResult.trend.ema20,
      ema50: trendResult.trend.ema50,
      ema200: trendResult.trend.ema200,
    },
    support: srResult.levels.support,
    resistance: srResult.levels.resistance,
    momentum: {
      value: macdResult.macd.histogram,
      increasing: macdResult.macd.histogram > 0,
    },
  };

  // Build summary
  const summaryParts: string[] = [];
  
  // RSI
  summaryParts.push(rsiResult.description);
  
  // Trend
  summaryParts.push(trendResult.description);
  
  // MACD
  if (macdResult.macd.crossover) {
    summaryParts.push(macdResult.description);
  }
  
  // Support/Resistance
  summaryParts.push(srResult.description);

  return {
    analysis,
    summary: summaryParts.join('. '),
  };
}

/**
 * Get a quick sentiment score from technical analysis
 * Returns -100 (very bearish) to +100 (very bullish)
 */
export function getTechnicalSentiment(analysis: TechnicalAnalysis): number {
  let score = 0;

  // RSI contribution (-30 to +30)
  if (analysis.rsi.signal === 'OVERSOLD') {
    score += 20; // Oversold = potential bounce = bullish
  } else if (analysis.rsi.signal === 'OVERBOUGHT') {
    score -= 20;
  }
  // RSI value contribution
  score += (analysis.rsi.value - 50) * 0.2;

  // MACD contribution (-30 to +30)
  if (analysis.macd.trend === 'BULLISH') {
    score += 20;
  } else if (analysis.macd.trend === 'BEARISH') {
    score -= 20;
  }
  score += Math.max(-10, Math.min(10, analysis.macd.histogram * 100));

  // Trend contribution (-40 to +40)
  if (analysis.trend.direction === 'UP') {
    score += analysis.trend.strength * 0.4;
  } else if (analysis.trend.direction === 'DOWN') {
    score -= analysis.trend.strength * 0.4;
  }

  return Math.max(-100, Math.min(100, Math.round(score)));
}
