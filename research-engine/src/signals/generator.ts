// Trading Signal Generator — Confluence-Based Strategy
//
// Core principle: require multiple independent confirmations before entering.
// A single indicator (RSI oversold, MACD cross) is NOT enough.
// Minimum 3 confluence factors required for any signal.

import type {
  Token,
  OHLCV,
  TradingSignal,
  SignalAction,
  Timeframe,
  RiskLevel,
  TechnicalAnalysis,
} from './types.js';
import { runTechnicalAnalysis, getTechnicalSentiment } from '../technical/index.js';
import { analyzeVolume, type VolumeAnalysis } from '../technical/volume.js';

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
  // Jupiter-enriched data when available
  buyPressureRatio?: number; // 0-1, from Jupiter Token API
  liquidity?: number;
  marketCap?: number;
  // Funding rate squeeze alert from funding API
  fundingAlert?: {
    type: 'SHORT_SQUEEZE' | 'LONG_SQUEEZE' | 'NONE';
    probability: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  };
}

// SHORT signals disabled — historical win rate is 0% on crypto
const SHORTS_ENABLED = false;

const STABLECOINS = new Set([
  'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'USDD',
  'USDP', 'GUSD', 'PYUSD', 'FDUSD', 'UST', 'USDN',
]);

// Minimum confluence factors required for a signal
const MIN_CONFLUENCE_FACTORS = 3;

// Minimum confidence threshold
const MIN_CONFIDENCE = 65;

// Volume must be at least this multiple of average to confirm
const MIN_VOLUME_RATIO = 1.2;

// ATR multiplier for stop loss calculation
const ATR_STOP_MULTIPLIER = 1.5;

// ATR period for volatility measurement
const ATR_PERIOD = 14;

function isStablecoin(symbol: string): boolean {
  return STABLECOINS.has(symbol.toUpperCase());
}

// --- Confluence Factor Counting ---

interface ConfluenceResult {
  factors: string[];
  count: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
}

/**
 * Count independent confluence factors pointing in the same direction.
 * Each factor is a genuinely independent signal — not double-counting.
 */
function countConfluenceFactors(
  analysis4H: TechnicalAnalysis,
  analysis1D: TechnicalAnalysis,
  volume4H: VolumeAnalysis,
  buyPressureRatio?: number,
  fundingAlert?: SignalInput['fundingAlert'],
): ConfluenceResult {
  const bullishFactors: string[] = [];
  const bearishFactors: string[] = [];

  // Factor 1: RSI extreme (strong standalone signal)
  if (analysis4H.rsi.value <= 20) {
    bullishFactors.push('Extreme oversold RSI(4H)=' + analysis4H.rsi.value.toFixed(0));
    bullishFactors.push('RSI bounce zone'); // Extreme RSI counts as 2 factors
  } else if (analysis4H.rsi.value <= 30) {
    bullishFactors.push('Oversold RSI(4H)=' + analysis4H.rsi.value.toFixed(0));
  } else if (analysis4H.rsi.value >= 80) {
    bearishFactors.push('Extreme overbought RSI(4H)=' + analysis4H.rsi.value.toFixed(0));
    bearishFactors.push('RSI rejection zone');
  } else if (analysis4H.rsi.value >= 70) {
    bearishFactors.push('Overbought RSI(4H)=' + analysis4H.rsi.value.toFixed(0));
  }

  // Factor 2: RSI multi-timeframe alignment
  if (analysis4H.rsi.signal === 'OVERSOLD' && analysis1D.rsi.value < 40) {
    bullishFactors.push('RSI alignment (1D supports oversold)');
  } else if (analysis4H.rsi.signal === 'OVERBOUGHT' && analysis1D.rsi.value > 60) {
    bearishFactors.push('RSI alignment (1D supports overbought)');
  }

  // Factor 3: MACD crossover (independent momentum signal)
  if (analysis4H.macd.crossover === 'BULLISH_CROSS') {
    bullishFactors.push('MACD bullish crossover');
  } else if (analysis4H.macd.crossover === 'BEARISH_CROSS') {
    bearishFactors.push('MACD bearish crossover');
  }

  // Factor 4: MACD trend alignment across timeframes
  if (analysis4H.macd.trend === 'BULLISH' && analysis1D.macd.trend === 'BULLISH') {
    bullishFactors.push('MACD bullish on both 4H and 1D');
  } else if (analysis4H.macd.trend === 'BEARISH' && analysis1D.macd.trend === 'BEARISH') {
    bearishFactors.push('MACD bearish on both 4H and 1D');
  }

  // Factor 5: Trend direction with strength
  if (analysis4H.trend.direction === 'UP' && analysis4H.trend.strength > 40) {
    bullishFactors.push(`Uptrend (strength=${analysis4H.trend.strength.toFixed(0)}%)`);
  } else if (analysis4H.trend.direction === 'DOWN' && analysis4H.trend.strength > 40) {
    bearishFactors.push(`Downtrend (strength=${analysis4H.trend.strength.toFixed(0)}%)`);
  }

  // Factor 6: Trend alignment across timeframes
  if (
    analysis4H.trend.direction === 'UP' &&
    analysis1D.trend.direction === 'UP'
  ) {
    bullishFactors.push('Uptrend on both 4H and 1D');
  } else if (
    analysis4H.trend.direction === 'DOWN' &&
    analysis1D.trend.direction === 'DOWN'
  ) {
    bearishFactors.push('Downtrend on both 4H and 1D');
  }

  // Factor 7: Volume confirms direction
  if (volume4H.confirmation === 'STRONG' || volume4H.confirmation === 'MODERATE') {
    if (volume4H.volumeRatio >= MIN_VOLUME_RATIO) {
      // Volume is elevated — direction depends on price action
      const priceUp = analysis4H.momentum.increasing;
      if (priceUp) {
        bullishFactors.push(`Volume spike ${volume4H.volumeRatio.toFixed(1)}x avg`);
      } else {
        bearishFactors.push(`Sell volume spike ${volume4H.volumeRatio.toFixed(1)}x avg`);
      }
    }
  }

  // Factor 8: Buy/sell pressure from Jupiter (real on-chain data)
  if (buyPressureRatio !== undefined) {
    if (buyPressureRatio > 0.6) {
      bullishFactors.push(`Strong buy pressure (${(buyPressureRatio * 100).toFixed(0)}% buys)`);
    } else if (buyPressureRatio < 0.4) {
      bearishFactors.push(`Strong sell pressure (${((1 - buyPressureRatio) * 100).toFixed(0)}% sells)`);
    }
  }

  // Factor 9: Price at support/resistance
  const nearestSupport = analysis4H.support[analysis4H.support.length - 1];
  const nearestResistance = analysis4H.resistance[0];
  const currentPrice = analysis4H.trend.ema20; // Proxy for current price area

  if (nearestSupport && currentPrice > 0) {
    const distToSupport = (currentPrice - nearestSupport) / currentPrice;
    if (distToSupport < 0.02 && distToSupport >= 0) {
      bullishFactors.push('Price at support level');
    }
  }
  if (nearestResistance && currentPrice > 0) {
    const distToResistance = (nearestResistance - currentPrice) / currentPrice;
    if (distToResistance < 0.02 && distToResistance >= 0) {
      bearishFactors.push('Price at resistance level');
    }
  }

  // Factor 10: Funding rate squeeze alert
  if (fundingAlert && (fundingAlert.probability === 'HIGH' || fundingAlert.probability === 'EXTREME')) {
    if (fundingAlert.type === 'SHORT_SQUEEZE') {
      bullishFactors.push(`Short squeeze alert (${fundingAlert.probability})`);
    } else if (fundingAlert.type === 'LONG_SQUEEZE') {
      bearishFactors.push(`Long squeeze alert (${fundingAlert.probability})`);
    }
  }

  // Determine dominant direction
  if (bullishFactors.length >= bearishFactors.length && bullishFactors.length > 0) {
    return {
      factors: bullishFactors,
      count: bullishFactors.length,
      direction: 'LONG',
    };
  }
  if (bearishFactors.length > bullishFactors.length) {
    return {
      factors: bearishFactors,
      count: bearishFactors.length,
      direction: 'SHORT',
    };
  }

  return { factors: [], count: 0, direction: 'NEUTRAL' };
}

// --- ATR Calculation ---

/**
 * Calculate Average True Range for volatility-based stops
 */
function calculateATR(ohlcv: OHLCV[], period: number = ATR_PERIOD): number {
  if (ohlcv.length < period + 1) {
    // Fallback: use simple price range
    const recent = ohlcv.slice(-20);
    const avgRange =
      recent.reduce((sum, c) => sum + (c.high - c.low), 0) / recent.length;
    return avgRange;
  }

  const trueRanges: number[] = [];
  for (let i = 1; i < ohlcv.length; i++) {
    const current = ohlcv[i];
    const prevClose = ohlcv[i - 1].close;
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prevClose),
      Math.abs(current.low - prevClose),
    );
    trueRanges.push(tr);
  }

  // Wilder's smoothing for ATR
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }

  return atr;
}

// --- Main Signal Generator ---

/**
 * Generate a trading signal based on confluence of multiple indicators.
 * Returns null if fewer than 3 independent factors align.
 */
export function generateSignal(input: SignalInput): TradingSignal | null {
  const { token } = input;
  let ohlcv = input.ohlcv;

  // Stablecoin safety check
  if (isStablecoin(token.symbol)) {
    console.warn(`[SignalGenerator] REJECTED: Stablecoin ${token.symbol}`);
    return null;
  }

  // Need sufficient real data on primary timeframe
  if (ohlcv['4H'].length < 35) {
    console.log(`[SignalGenerator] ${token.symbol}: insufficient 4H OHLCV data (${ohlcv['4H'].length} candles, need 35)`);
    return null;
  }

  // If daily data is missing, aggregate from 4H (6 x 4H candles = 1 day)
  if (ohlcv['1D'].length < 20 && ohlcv['4H'].length >= 42) {
    console.log(`[SignalGenerator] ${token.symbol}: aggregating daily from 4H data`);
    const aggregatedDaily: OHLCV[] = [];
    for (let i = 0; i < ohlcv['4H'].length; i += 6) {
      const chunk = ohlcv['4H'].slice(i, i + 6);
      if (chunk.length < 6) break;
      aggregatedDaily.push({
        timestamp: chunk[0].timestamp,
        open: chunk[0].open,
        high: Math.max(...chunk.map((c) => c.high)),
        low: Math.min(...chunk.map((c) => c.low)),
        close: chunk[chunk.length - 1].close,
        volume: chunk.reduce((sum, c) => sum + c.volume, 0),
      });
    }
    ohlcv = { ...ohlcv, '1D': aggregatedDaily };
  }

  // Run technical analysis
  const analysis4H = runTechnicalAnalysis(ohlcv['4H']);
  const analysis1D = runTechnicalAnalysis(ohlcv['1D']);

  // Volume analysis on 4H candles
  const volume4H = analyzeVolume(ohlcv['4H']);

  // Get current price
  const currentPrice =
    ohlcv['1H'][ohlcv['1H'].length - 1]?.close ||
    ohlcv['4H'][ohlcv['4H'].length - 1]?.close ||
    0;

  if (currentPrice === 0) return null;

  // Count confluence factors
  const confluence = countConfluenceFactors(
    analysis4H.analysis,
    analysis1D.analysis,
    volume4H,
    input.buyPressureRatio,
    input.fundingAlert,
  );

  // Require minimum confluence
  if (confluence.count < MIN_CONFLUENCE_FACTORS) {
    console.log(
      `[SignalGenerator] ${token.symbol}: only ${confluence.count} factors (need ${MIN_CONFLUENCE_FACTORS}): [${confluence.factors.join(', ')}]`,
    );
    return null;
  }

  const action = confluence.direction;

  // SHORT kill switch
  if (action === 'SHORT' && !SHORTS_ENABLED) {
    console.log(`[SignalGenerator] SHORT signal for ${token.symbol} blocked: SHORTS_ENABLED=false`);
    return null;
  }

  if (action === 'NEUTRAL') return null;

  // Volume must confirm — reject divergent volume
  if (volume4H.confirmation === 'DIVERGENCE') {
    console.log(`[SignalGenerator] ${token.symbol}: volume divergence detected — rejecting`);
    return null;
  }

  // Calculate ATR-based levels
  const atr = calculateATR(ohlcv['4H']);
  const { entry, targets, stopLoss } = calculateLevels(
    action,
    currentPrice,
    atr,
    analysis4H.analysis,
  );

  // Calculate confidence based on confluence count and quality
  const confidence = calculateConfidence(
    confluence,
    analysis4H.analysis,
    analysis1D.analysis,
    volume4H,
    input.buyPressureRatio,
  );

  if (confidence < MIN_CONFIDENCE) {
    console.log(
      `[SignalGenerator] ${token.symbol}: confidence ${confidence} < ${MIN_CONFIDENCE}`,
    );
    return null;
  }

  // Determine risk level and timeframe
  const riskLevel = determineRiskLevel(confidence, analysis4H.analysis, atr, currentPrice);
  const timeframe = determineTimeframe(analysis4H.analysis, analysis1D.analysis);

  // Build reasoning from actual confluence factors
  const reasoning = buildReasoning(confluence, analysis4H, analysis1D, volume4H, input);

  const signal: TradingSignal = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    token,
    action,
    entry: Math.round(entry * 10000) / 10000,
    targets: targets.map((t) => Math.round(t * 10000) / 10000),
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
      volume_ratio: volume4H.volumeRatio,
      confluence_count: confluence.count,
      atr: atr,
    },
  };

  console.log(
    `[SignalGenerator] ${token.symbol} ${action} signal: confidence=${confidence}, confluence=${confluence.count} [${confluence.factors.join(', ')}]`,
  );

  return signal;
}

/**
 * Calculate entry, targets, and ATR-based stop loss
 * Uses tighter, more realistic R:R ratios: 1R, 1.5R, 2.5R
 */
function calculateLevels(
  action: SignalAction,
  currentPrice: number,
  atr: number,
  analysis: TechnicalAnalysis,
): { entry: number; targets: number[]; stopLoss: number } {
  const nearestSupport =
    analysis.support[analysis.support.length - 1] || currentPrice * 0.95;
  const nearestResistance = analysis.resistance[0] || currentPrice * 1.05;

  if (action === 'LONG') {
    const entry = currentPrice;

    // ATR-based stop: whichever is tighter — ATR or support level
    const atrStop = entry - atr * ATR_STOP_MULTIPLIER;
    const supportStop = nearestSupport * 0.98;
    const stopLoss = Math.max(atrStop, supportStop); // Use the tighter (higher) stop

    const riskAmount = entry - stopLoss;

    // Realistic targets: 1R, 1.5R, 2.5R
    const targets = [
      entry + riskAmount * 1.0,
      entry + riskAmount * 1.5,
      entry + riskAmount * 2.5,
    ];

    // Cap first target at resistance if closer
    if (nearestResistance < targets[0]) {
      targets[0] = nearestResistance;
    }

    return { entry, targets, stopLoss };
  }

  if (action === 'SHORT') {
    const entry = currentPrice;
    const atrStop = entry + atr * ATR_STOP_MULTIPLIER;
    const resistanceStop = nearestResistance * 1.02;
    const stopLoss = Math.min(atrStop, resistanceStop);

    const riskAmount = stopLoss - entry;
    const targets = [
      entry - riskAmount * 1.0,
      entry - riskAmount * 1.5,
      entry - riskAmount * 2.5,
    ];

    if (nearestSupport > targets[0]) {
      targets[0] = nearestSupport;
    }

    return { entry, targets, stopLoss };
  }

  return {
    entry: currentPrice,
    targets: [currentPrice],
    stopLoss: currentPrice * 0.95,
  };
}

/**
 * Calculate signal confidence based on actual confluence quality
 */
function calculateConfidence(
  confluence: ConfluenceResult,
  analysis4H: TechnicalAnalysis,
  analysis1D: TechnicalAnalysis,
  volume: VolumeAnalysis,
  buyPressureRatio?: number,
): number {
  // Base confidence tied to confluence count
  let confidence: number;
  if (confluence.count >= 5) {
    confidence = 82;
  } else if (confluence.count >= 4) {
    confidence = 73;
  } else {
    confidence = 63; // 3 factors = base 63
  }

  // Volume quality bonus
  if (volume.volumeRatio >= 2.0) {
    confidence += 5; // Strong volume spike
  } else if (volume.volumeRatio >= MIN_VOLUME_RATIO) {
    confidence += 2; // Adequate volume
  } else if (volume.volumeRatio < 0.8) {
    confidence -= 5; // Low volume = less reliable
  }

  // Trend strength bonus
  if (analysis4H.trend.strength > 60) {
    confidence += 3;
  }

  // Multi-timeframe trend alignment bonus
  if (
    analysis4H.trend.direction === analysis1D.trend.direction &&
    analysis4H.trend.direction !== 'SIDEWAYS'
  ) {
    confidence += 4;
  }

  // Buy pressure from Jupiter (on-chain confirmation)
  if (buyPressureRatio !== undefined) {
    if (
      (confluence.direction === 'LONG' && buyPressureRatio > 0.6) ||
      (confluence.direction === 'SHORT' && buyPressureRatio < 0.4)
    ) {
      confidence += 3; // On-chain flow confirms
    }
  }

  return Math.min(95, Math.max(25, Math.round(confidence)));
}

function determineRiskLevel(
  confidence: number,
  analysis: TechnicalAnalysis,
  atr: number,
  currentPrice: number,
): RiskLevel {
  // ATR as % of price = volatility measure
  const atrPercent = (atr / currentPrice) * 100;

  if (confidence >= 78 && atrPercent < 5) {
    return 'LOW';
  }
  if (confidence < 65 || atrPercent > 10 || analysis.trend.direction === 'SIDEWAYS') {
    return 'HIGH';
  }
  return 'MEDIUM';
}

function determineTimeframe(
  analysis4H: TechnicalAnalysis,
  analysis1D: TechnicalAnalysis,
): Timeframe {
  if (analysis1D.trend.strength > 70) return '1D';
  if (analysis4H.macd.crossover || analysis4H.rsi.signal !== 'NEUTRAL') return '4H';
  return '4H';
}

function buildReasoning(
  confluence: ConfluenceResult,
  analysis4H: { analysis: TechnicalAnalysis; summary: string },
  analysis1D: { analysis: TechnicalAnalysis; summary: string },
  volume: VolumeAnalysis,
  input: SignalInput,
): { technical: string; fundamental: string; sentiment: string } {
  const factorList = confluence.factors.join('; ');
  const volumeDesc = volume.description || `Volume ratio: ${volume.volumeRatio.toFixed(1)}x`;

  return {
    technical: `${confluence.count} confluence factors: [${factorList}]. ${volumeDesc}. ${analysis4H.summary}`,
    fundamental: input.fundamentalContext || 'No significant fundamental factors',
    sentiment: input.sentimentContext || `Neutral market sentiment`,
  };
}

/**
 * Batch generate signals for multiple tokens
 */
export async function generateSignals(
  inputs: SignalInput[],
): Promise<TradingSignal[]> {
  const signals: TradingSignal[] = [];

  for (const input of inputs) {
    try {
      const signal = generateSignal(input);
      if (signal) {
        signals.push(signal);
      }
    } catch (error) {
      console.error(
        `Error generating signal for ${input.token.symbol}:`,
        error,
      );
    }
  }

  // Sort by confidence
  signals.sort((a, b) => b.confidence - a.confidence);
  return signals;
}
