// Trading Signal Generator

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

// Generate a simple UUID without external dependency
function generateId(): string {
  return 'sig_' + Math.random().toString(36).substring(2, 15);
}

interface SignalInput {
  token: Token;
  ohlcv: {
    '1H': OHLCV[];
    '4H': OHLCV[];
    '1D': OHLCV[];
  };
  fundamentalContext?: string;
  sentimentContext?: string;
}

// List of stablecoins that should NEVER be shorted
const STABLECOINS = new Set([
  'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'USDD', 
  'USDP', 'GUSD', 'PYUSD', 'FDUSD', 'UST', 'USDN'
]);

/**
 * Check if a token is a stablecoin
 */
function isStablecoin(symbol: string): boolean {
  return STABLECOINS.has(symbol.toUpperCase());
}

/**
 * Generate a trading signal based on technical analysis
 */
export function generateSignal(input: SignalInput): TradingSignal | null {
  const { token, ohlcv } = input;

  // 🚨 STABLECOIN SAFETY CHECK
  // NEVER generate SHORT signals for stablecoins - they're pegged!
  if (isStablecoin(token.symbol)) {
    console.warn(`[SignalGenerator] ⚠️  REJECTED: Stablecoin ${token.symbol} detected - skipping signal generation`);
    console.warn('[SignalGenerator] Stablecoins are USD-pegged assets and should not be traded');
    return null;
  }

  // Run technical analysis on different timeframes
  const analysis4H = runTechnicalAnalysis(ohlcv['4H']);
  const analysis1D = runTechnicalAnalysis(ohlcv['1D']);

  // Get current price
  const currentPrice = ohlcv['1H'][ohlcv['1H'].length - 1]?.close || 
                       ohlcv['4H'][ohlcv['4H'].length - 1]?.close || 0;

  if (currentPrice === 0) {
    return null;
  }

  // Calculate sentiment scores
  const sentiment4H = getTechnicalSentiment(analysis4H.analysis);
  const sentiment1D = getTechnicalSentiment(analysis1D.analysis);
  const avgSentiment = (sentiment4H + sentiment1D) / 2;

  // Determine action
  const action = determineAction(analysis4H.analysis, analysis1D.analysis, avgSentiment);
  
  // If no clear action, don't generate signal
  if (action === 'HOLD') {
    return null;
  }

  // 🚨 ADDITIONAL STABLECOIN SAFETY CHECK
  // Double-check: if somehow a SHORT signal was generated for a stablecoin, reject it
  if (action === 'SHORT' && isStablecoin(token.symbol)) {
    console.error(`[SignalGenerator] 🚨 CRITICAL: SHORT signal attempted for stablecoin ${token.symbol} - BLOCKED!`);
    return null;
  }

  // Calculate entry, targets, and stop loss
  const { entry, targets, stopLoss } = calculateLevels(
    action,
    currentPrice,
    analysis4H.analysis
  );

  // Calculate confidence
  const confidence = calculateConfidence(analysis4H.analysis, analysis1D.analysis, avgSentiment);

  // Determine risk level
  const riskLevel = determineRiskLevel(confidence, analysis4H.analysis);

  // Determine best timeframe for the signal
  const timeframe = determineTimeframe(analysis4H.analysis, analysis1D.analysis);

  // Build reasoning
  const reasoning = buildReasoning(
    analysis4H,
    analysis1D,
    input.fundamentalContext,
    input.sentimentContext
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
    },
  };

  return signal;
}

/**
 * Determine trading action based on analysis
 * More aggressive thresholds to generate actionable signals
 * ENHANCED: RSI oversold/overbought now primary signal driver
 */
function determineAction(
  analysis4H: TechnicalAnalysis,
  analysis1D: TechnicalAnalysis,
  sentiment: number
): SignalAction {
  // === EXTREME RSI SIGNALS (HIGHEST PRIORITY) ===
  
  // Extreme oversold (RSI < 20) - Strong LONG signal
  if (analysis4H.rsi.value <= 20) {
    return 'LONG';
  }
  
  // Extreme overbought (RSI > 80) - Strong SHORT signal
  if (analysis4H.rsi.value >= 80) {
    return 'SHORT';
  }
  
  // === RSI-BASED SIGNALS (HIGH PRIORITY) ===
  
  // Oversold with any positive confirmation
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
  
  // Overbought with any negative confirmation
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
  
  // === HIGH CONVICTION SIGNALS ===
  
  // Strong bullish: Oversold with bullish momentum
  if (
    sentiment > 25 &&
    analysis4H.rsi.signal === 'OVERSOLD' &&
    analysis4H.trend.direction !== 'DOWN'
  ) {
    return 'LONG';
  }

  // Strong bearish: Overbought with bearish momentum
  if (
    sentiment < -25 &&
    analysis4H.rsi.signal === 'OVERBOUGHT' &&
    analysis4H.trend.direction !== 'UP'
  ) {
    return 'SHORT';
  }

  // === TREND FOLLOWING ===
  
  // Uptrend with MACD confirmation
  if (
    analysis4H.trend.direction === 'UP' &&
    analysis4H.trend.strength > 35 &&
    analysis4H.macd.trend === 'BULLISH' &&
    sentiment > 10
  ) {
    return 'LONG';
  }

  // Downtrend with MACD confirmation
  if (
    analysis4H.trend.direction === 'DOWN' &&
    analysis4H.trend.strength > 35 &&
    analysis4H.macd.trend === 'BEARISH' &&
    sentiment < -10
  ) {
    return 'SHORT';
  }

  // === MACD CROSSOVER SIGNALS ===
  
  // Bullish crossover with supportive RSI
  if (
    analysis4H.macd.crossover === 'BULLISH_CROSS' &&
    analysis4H.rsi.value < 60 &&
    analysis4H.trend.direction !== 'DOWN'
  ) {
    return 'LONG';
  }

  // Bearish crossover with supportive RSI
  if (
    analysis4H.macd.crossover === 'BEARISH_CROSS' &&
    analysis4H.rsi.value > 40 &&
    analysis4H.trend.direction !== 'UP'
  ) {
    return 'SHORT';
  }

  // === MEAN REVERSION ===
  
  // Deep oversold bounce setup
  if (
    analysis4H.rsi.value < 35 &&
    analysis1D.rsi.value < 45 &&
    (analysis4H.macd.crossover === 'BULLISH_CROSS' || analysis4H.macd.histogram > 0)
  ) {
    return 'LONG';
  }

  // Extended overbought rejection
  if (
    analysis4H.rsi.value > 65 &&
    analysis1D.rsi.value > 55 &&
    (analysis4H.macd.crossover === 'BEARISH_CROSS' || analysis4H.macd.histogram < 0)
  ) {
    return 'SHORT';
  }

  // === MOMENTUM PLAYS ===
  
  // Strong momentum with trend alignment
  if (
    sentiment > 30 &&
    analysis4H.trend.direction === 'UP' &&
    analysis4H.rsi.value > 50 && analysis4H.rsi.value < 70
  ) {
    return 'LONG';
  }

  if (
    sentiment < -30 &&
    analysis4H.trend.direction === 'DOWN' &&
    analysis4H.rsi.value < 50 && analysis4H.rsi.value > 30
  ) {
    return 'SHORT';
  }

  // Avoid truly unclear situations
  if (Math.abs(sentiment) < 8) {
    return 'HOLD';
  }

  return 'HOLD';
}

/**
 * Calculate entry, target, and stop loss levels
 */
function calculateLevels(
  action: SignalAction,
  currentPrice: number,
  analysis: TechnicalAnalysis
): { entry: number; targets: number[]; stopLoss: number } {
  const nearestSupport = analysis.support[analysis.support.length - 1] || currentPrice * 0.95;
  const nearestResistance = analysis.resistance[0] || currentPrice * 1.05;

  if (action === 'LONG') {
    const entry = currentPrice;
    const stopLoss = Math.min(nearestSupport * 0.98, currentPrice * 0.95);
    const riskAmount = entry - stopLoss;
    
    const targets = [
      entry + riskAmount * 1.5,  // 1.5R
      entry + riskAmount * 2.5,  // 2.5R
      entry + riskAmount * 4,    // 4R
    ];

    // Adjust targets to resistance levels if closer
    if (nearestResistance < targets[0]) {
      targets[0] = nearestResistance;
    }

    return { entry, targets, stopLoss };
  }

  if (action === 'SHORT') {
    const entry = currentPrice;
    const stopLoss = Math.max(nearestResistance * 1.02, currentPrice * 1.05);
    const riskAmount = stopLoss - entry;
    
    const targets = [
      entry - riskAmount * 1.5,
      entry - riskAmount * 2.5,
      entry - riskAmount * 4,
    ];

    // Adjust targets to support levels if closer
    if (nearestSupport > targets[0]) {
      targets[0] = nearestSupport;
    }

    return { entry, targets, stopLoss };
  }

  // Default for HOLD/AVOID
  return {
    entry: currentPrice,
    targets: [currentPrice],
    stopLoss: currentPrice * 0.95,
  };
}

/**
 * Calculate signal confidence (0-100)
 * Enhanced with RSI-based confidence boosting
 */
function calculateConfidence(
  analysis4H: TechnicalAnalysis,
  analysis1D: TechnicalAnalysis,
  sentiment: number
): number {
  let confidence = 50; // Base confidence

  // === ENHANCED RSI WEIGHTING ===
  
  // Extreme RSI levels get significant confidence boost
  if (analysis4H.rsi.value <= 20 || analysis4H.rsi.value >= 80) {
    confidence += 20; // Extreme levels
  } else if (analysis4H.rsi.value <= 25 || analysis4H.rsi.value >= 75) {
    confidence += 15; // Strong levels
  } else if (analysis4H.rsi.signal === 'OVERSOLD' || analysis4H.rsi.signal === 'OVERBOUGHT') {
    confidence += 10; // Standard oversold/overbought
  }

  // RSI alignment bonus (both timeframes agreeing)
  if (
    (analysis4H.rsi.signal === 'OVERSOLD' && analysis1D.rsi.signal === 'OVERSOLD') ||
    (analysis4H.rsi.signal === 'OVERBOUGHT' && analysis1D.rsi.signal === 'OVERBOUGHT')
  ) {
    confidence += 15;
  }
  
  // Partial alignment (one timeframe supporting)
  if (
    (analysis4H.rsi.signal === 'OVERSOLD' && analysis1D.rsi.value < 40) ||
    (analysis4H.rsi.signal === 'OVERBOUGHT' && analysis1D.rsi.value > 60)
  ) {
    confidence += 5;
  }

  // === OTHER INDICATORS ===

  // MACD alignment bonus
  if (analysis4H.macd.trend === analysis1D.macd.trend && analysis4H.macd.trend !== 'NEUTRAL') {
    confidence += 10;
  }

  // Trend alignment bonus
  if (analysis4H.trend.direction === analysis1D.trend.direction && 
      analysis4H.trend.direction !== 'SIDEWAYS') {
    confidence += 15;
  }

  // Strong sentiment bonus
  confidence += Math.abs(sentiment) * 0.1;

  // MACD crossover bonus
  if (analysis4H.macd.crossover) {
    confidence += 10;
  }

  return Math.min(95, Math.max(25, Math.round(confidence)));
}

/**
 * Determine risk level based on conditions
 */
function determineRiskLevel(
  confidence: number,
  analysis: TechnicalAnalysis
): RiskLevel {
  if (confidence > 75 && analysis.trend.strength > 60) {
    return 'LOW';
  }

  if (confidence < 50 || analysis.trend.direction === 'SIDEWAYS') {
    return 'HIGH';
  }

  return 'MEDIUM';
}

/**
 * Determine best timeframe for the signal
 */
function determineTimeframe(
  analysis4H: TechnicalAnalysis,
  analysis1D: TechnicalAnalysis
): Timeframe {
  // If daily trend is strong, use longer timeframe
  if (analysis1D.trend.strength > 70) {
    return '1D';
  }

  // If 4H has clear signal
  if (analysis4H.macd.crossover || analysis4H.rsi.signal !== 'NEUTRAL') {
    return '4H';
  }

  return '4H';
}

/**
 * Build reasoning object for signal
 * Enhanced with RSI-focused reasoning
 */
function buildReasoning(
  analysis4H: { analysis: TechnicalAnalysis; summary: string },
  analysis1D: { analysis: TechnicalAnalysis; summary: string },
  fundamentalContext?: string,
  sentimentContext?: string
): { technical: string; fundamental: string; sentiment: string } {
  const rsi4H = analysis4H.analysis.rsi;
  const rsi1D = analysis1D.analysis.rsi;
  
  // Build RSI-focused reasoning
  let rsiReasoning = '';
  if (rsi4H.value <= 20) {
    rsiReasoning = `EXTREME OVERSOLD: RSI(4H)=${rsi4H.value} — high probability bounce zone. `;
  } else if (rsi4H.value >= 80) {
    rsiReasoning = `EXTREME OVERBOUGHT: RSI(4H)=${rsi4H.value} — high probability pullback zone. `;
  } else if (rsi4H.signal === 'OVERSOLD') {
    rsiReasoning = `OVERSOLD: RSI(4H)=${rsi4H.value} — potential reversal zone. `;
  } else if (rsi4H.signal === 'OVERBOUGHT') {
    rsiReasoning = `OVERBOUGHT: RSI(4H)=${rsi4H.value} — potential reversal zone. `;
  }
  
  // Add alignment info
  if (rsi4H.signal === rsi1D.signal && rsi4H.signal !== 'NEUTRAL') {
    rsiReasoning += `Multi-timeframe RSI alignment (1D RSI=${rsi1D.value}). `;
  }
  
  return {
    technical: `${rsiReasoning}${analysis4H.summary}. Daily: trend ${analysis1D.analysis.trend.direction.toLowerCase()}`,
    fundamental: fundamentalContext || 'No significant fundamental factors',
    sentiment: sentimentContext || 'Neutral market sentiment',
  };
}

/**
 * Batch generate signals for multiple tokens
 */
export async function generateSignals(
  inputs: SignalInput[]
): Promise<TradingSignal[]> {
  const signals: TradingSignal[] = [];

  for (const input of inputs) {
    try {
      const signal = generateSignal(input);
      if (signal) {
        signals.push(signal);
      }
    } catch (error) {
      console.error(`Error generating signal for ${input.token.symbol}:`, error);
    }
  }

  // Sort by confidence
  signals.sort((a, b) => b.confidence - a.confidence);

  return signals;
}
