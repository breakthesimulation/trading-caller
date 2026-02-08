/**
 * Enhanced Trading Signal Generator
 * Includes volume confirmation, Fibonacci levels, fundamental analysis, and confidence breakdown
 */

import type { 
  Token, 
  OHLCV, 
  TradingSignal, 
  SignalAction,
  Timeframe,
  RiskLevel,
  TechnicalAnalysis 
} from './types.js';
import { runTechnicalAnalysis, getTechnicalSentiment } from '../technical/index.js';
import { analyzeVolume, calculateVolumeScore } from '../technical/volume.js';
import { calculateFibonacciLevels, getFibDescription, isNearFibLevel } from '../technical/fibonacci.js';
import { getUnlockSummary } from '../fundamental/unlocks.js';
import { calculateConfidenceBreakdown, getHistoricalWinRate } from './confidence.js';

// Generate a simple UUID without external dependency
function generateId(): string {
  return 'sig_' + Math.random().toString(36).substring(2, 15);
}

interface EnhancedSignalInput {
  token: Token;
  ohlcv: {
    '1H': OHLCV[];
    '4H': OHLCV[];
    '1D': OHLCV[];
  };
}

/**
 * Generate an enhanced trading signal with comprehensive analysis
 */
export function generateEnhancedSignal(input: EnhancedSignalInput): TradingSignal | null {
  const { token, ohlcv } = input;

  // Run technical analysis on different timeframes
  const analysis4H = runTechnicalAnalysis(ohlcv['4H']);
  const analysis1D = runTechnicalAnalysis(ohlcv['1D']);

  // Get current price
  const currentPrice = ohlcv['1H'][ohlcv['1H'].length - 1]?.close || 
                       ohlcv['4H'][ohlcv['4H'].length - 1]?.close || 0;

  if (currentPrice === 0) {
    return null;
  }

  // === NEW: Volume Analysis ===
  const volumeAnalysis = analyzeVolume(ohlcv['4H'], 20);
  
  // === NEW: Fibonacci Levels ===
  const fibLevels = calculateFibonacciLevels(ohlcv['1D'], 50);
  const fibDescription = fibLevels ? getFibDescription(fibLevels) : null;
  const nearFibLevel = fibLevels ? isNearFibLevel(fibLevels) : null;
  
  // === NEW: Fundamental Analysis ===
  const unlockSummary = getUnlockSummary(token.symbol);

  // Calculate sentiment scores
  const sentiment4H = getTechnicalSentiment(analysis4H.analysis);
  const sentiment1D = getTechnicalSentiment(analysis1D.analysis);
  const avgSentiment = (sentiment4H + sentiment1D) / 2;

  // Determine action
  const action = determineAction(
    analysis4H.analysis, 
    analysis1D.analysis, 
    avgSentiment,
    volumeAnalysis
  );
  
  // If no clear action, don't generate signal
  if (action === 'HOLD') {
    return null;
  }

  // Calculate entry, targets, and stop loss
  const { entry, targets, stopLoss } = calculateLevels(
    action,
    currentPrice,
    analysis4H.analysis,
    fibLevels
  );

  // === NEW: Enhanced Confidence with Breakdown ===
  
  // Calculate fundamental score (primarily from unlocks)
  const fundamentalScore = unlockSummary.impactScore;
  
  // Add volume score
  const volumeScore = calculateVolumeScore(volumeAnalysis, action);
  
  // Get historical win rate for similar setups
  const historicalData = getHistoricalWinRate(
    action,
    analysis4H.analysis.rsi.value,
    analysis4H.analysis.trend.direction,
    '4H'
  );
  
  // Calculate detailed confidence breakdown
  const confidenceBreakdown = calculateConfidenceBreakdown(
    analysis4H.analysis,
    analysis1D.analysis,
    avgSentiment,
    fundamentalScore + volumeScore, // Combined fundamental+volume score
    historicalData
  );
  
  const confidence = confidenceBreakdown.totalConfidence;

  // Determine risk level
  const riskLevel = determineRiskLevel(confidence, analysis4H.analysis, volumeAnalysis);

  // Determine best timeframe for the signal
  const timeframe = determineTimeframe(analysis4H.analysis, analysis1D.analysis);

  // === NEW: Enhanced Reasoning ===
  const reasoning = buildEnhancedReasoning(
    analysis4H,
    analysis1D,
    volumeAnalysis,
    fibDescription,
    nearFibLevel,
    unlockSummary,
    confidenceBreakdown
  );

  const signal: TradingSignal = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    token,
    action,
    entry: Math.round(entry * 10000) / 10000,
    targets: targets.map(t => Math.round(t * 10000) / 10000),
    stopLoss: Math.round(stopLoss * 10000) / 10000,
    confidence,
    timeframe,
    reasoning,
    riskLevel,
    technicalAnalysis: analysis4H.analysis,
    indicators: {
      rsi_4h: analysis4H.analysis.rsi.value,
      rsi_1d: analysis1D.analysis.rsi.value,
      trend_strength: analysis4H.analysis.trend.strength,
      macd_histogram: analysis4H.analysis.macd.histogram,
      volume_ratio: volumeAnalysis.volumeRatio,
      volume_confirmation: volumeAnalysis.confirmation,
      ...(fibLevels && {
        fib_nearest_level: fibLevels.current.levelName,
        fib_distance: fibLevels.current.distancePercent,
      }),
    },
    // Store confidence breakdown for display
    confidenceFactors: confidenceBreakdown.factors,
  };

  return signal;
}

/**
 * Enhanced action determination with volume confirmation
 */
function determineAction(
  analysis4H: TechnicalAnalysis,
  analysis1D: TechnicalAnalysis,
  sentiment: number,
  volumeAnalysis: any
): SignalAction {
  // Volume divergence is a red flag
  if (volumeAnalysis.confirmation === 'DIVERGENCE') {
    return 'HOLD'; // Don't trade on divergence
  }
  
  // Use existing logic from original generator
  // [Same as before - keeping existing signal generation logic]
  
  // Extreme RSI + volume confirmation
  if (analysis4H.rsi.value <= 20 && volumeAnalysis.confirmation === 'STRONG') {
    return 'LONG';
  }
  
  if (analysis4H.rsi.value >= 80 && volumeAnalysis.confirmation === 'STRONG') {
    return 'SHORT';
  }
  
  // Standard RSI signals
  if (
    analysis4H.rsi.signal === 'OVERSOLD' && (
      sentiment > 0 ||
      analysis4H.macd.histogram > 0 ||
      analysis4H.macd.crossover === 'BULLISH_CROSS' ||
      analysis1D.rsi.value < 40
    )
  ) {
    return 'LONG';
  }
  
  if (
    analysis4H.rsi.signal === 'OVERBOUGHT' && (
      sentiment < 0 ||
      analysis4H.macd.histogram < 0 ||
      analysis4H.macd.crossover === 'BEARISH_CROSS' ||
      analysis1D.rsi.value > 60
    )
  ) {
    return 'SHORT';
  }
  
  // Trend-based signals
  if (
    analysis4H.trend.direction === 'UP' &&
    analysis4H.trend.strength > 35 &&
    analysis4H.macd.trend === 'BULLISH' &&
    sentiment > 10
  ) {
    return 'LONG';
  }

  if (
    analysis4H.trend.direction === 'DOWN' &&
    analysis4H.trend.strength > 35 &&
    analysis4H.macd.trend === 'BEARISH' &&
    sentiment < -10
  ) {
    return 'SHORT';
  }

  return 'HOLD';
}

/**
 * Calculate levels with Fibonacci consideration
 */
function calculateLevels(
  action: SignalAction,
  currentPrice: number,
  analysis: TechnicalAnalysis,
  fibLevels: any
): { entry: number; targets: number[]; stopLoss: number } {
  const nearestSupport = analysis.support[analysis.support.length - 1] || currentPrice * 0.95;
  const nearestResistance = analysis.resistance[0] || currentPrice * 1.05;

  if (action === 'LONG') {
    const entry = currentPrice;
    let stopLoss = Math.min(nearestSupport * 0.98, currentPrice * 0.95);
    
    // Adjust stop loss if near Fibonacci support
    if (fibLevels && fibLevels.retracement) {
      const fibSupport = Object.values(fibLevels.retracement).find(
        (level: any) => level < currentPrice && level > stopLoss
      ) as number | undefined;
      if (fibSupport) {
        stopLoss = fibSupport * 0.99;
      }
    }
    
    const riskAmount = entry - stopLoss;
    
    let targets = [
      entry + riskAmount * 1.5,
      entry + riskAmount * 2.5,
      entry + riskAmount * 4,
    ];
    
    // Adjust targets to Fibonacci extension levels if available
    if (fibLevels && fibLevels.extension) {
      const fibTargets = Object.values(fibLevels.extension).filter(
        (level: any) => level > currentPrice
      ) as number[];
      if (fibTargets.length > 0) {
        targets[1] = fibTargets[0];
        if (fibTargets.length > 1) targets[2] = fibTargets[1];
      }
    }

    return { entry, targets, stopLoss };
  }

  if (action === 'SHORT') {
    const entry = currentPrice;
    let stopLoss = Math.max(nearestResistance * 1.02, currentPrice * 1.05);
    
    // Adjust stop loss if near Fibonacci resistance
    if (fibLevels && fibLevels.retracement) {
      const fibResistance = Object.values(fibLevels.retracement).find(
        (level: any) => level > currentPrice && level < stopLoss
      ) as number | undefined;
      if (fibResistance) {
        stopLoss = fibResistance * 1.01;
      }
    }
    
    const riskAmount = stopLoss - entry;
    
    const targets = [
      entry - riskAmount * 1.5,
      entry - riskAmount * 2.5,
      entry - riskAmount * 4,
    ];

    return { entry, targets, stopLoss };
  }

  return {
    entry: currentPrice,
    targets: [currentPrice],
    stopLoss: currentPrice * 0.95,
  };
}

/**
 * Determine risk level with volume consideration
 */
function determineRiskLevel(
  confidence: number,
  analysis: TechnicalAnalysis,
  volumeAnalysis: any
): RiskLevel {
  // High risk if volume divergence
  if (volumeAnalysis.confirmation === 'DIVERGENCE') {
    return 'HIGH';
  }
  
  // Low risk if high confidence + strong volume
  if (confidence > 75 && analysis.trend.strength > 60 && volumeAnalysis.confirmation === 'STRONG') {
    return 'LOW';
  }

  // High risk if low confidence or sideways
  if (confidence < 50 || analysis.trend.direction === 'SIDEWAYS') {
    return 'HIGH';
  }

  return 'MEDIUM';
}

/**
 * Determine timeframe
 */
function determineTimeframe(
  analysis4H: TechnicalAnalysis,
  analysis1D: TechnicalAnalysis
): Timeframe {
  if (analysis1D.trend.strength > 70) {
    return '1D';
  }

  if (analysis4H.macd.crossover || analysis4H.rsi.signal !== 'NEUTRAL') {
    return '4H';
  }

  return '4H';
}

/**
 * Build enhanced reasoning with all new factors
 */
function buildEnhancedReasoning(
  analysis4H: any,
  analysis1D: any,
  volumeAnalysis: any,
  fibDescription: string | null,
  nearFibLevel: any,
  unlockSummary: any,
  confidenceBreakdown: any
): { technical: string; fundamental: string; sentiment: string } {
  // Technical reasoning
  let technical = analysis4H.summary;
  
  // Add volume confirmation
  technical += `. ${volumeAnalysis.description}`;
  
  // Add Fibonacci context
  if (fibDescription) {
    technical += `. ${fibDescription}`;
  }
  
  // Add daily trend
  technical += `. Daily: trend ${analysis1D.analysis.trend.direction.toLowerCase()}`;
  
  // Fundamental reasoning
  let fundamental = unlockSummary.summary;
  
  // Add impact warning if negative
  if (unlockSummary.impactScore < -20) {
    fundamental += ` ⚠️ Bearish unlock pressure`;
  }
  
  // Sentiment reasoning
  const sentiment = confidenceBreakdown.reasoning;
  
  return {
    technical,
    fundamental,
    sentiment,
  };
}
