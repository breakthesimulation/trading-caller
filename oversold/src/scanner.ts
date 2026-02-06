// RSI Scanner - Internal implementation using our existing TA
// Falls back to internal calculation since oversold.lol has bot protection

import type { 
  RSIReading, 
  OversoldScanResult, 
  RSIThresholds, 
  RSISignalStrength,
  DEFAULT_THRESHOLDS 
} from './types.js';
import { TRACKED_TOKENS } from '../../volume-scanner/src/tokens.js';
import { calculateRSIFromOHLCV } from '../../research-engine/src/technical/rsi.js';
import type { OHLCV } from '../../research-engine/src/signals/types.js';
import { getOHLCV } from '../../research-engine/src/data/birdeye.js';

const DEFAULT_RSI_THRESHOLDS: RSIThresholds = {
  oversold: 30,
  overbought: 70,
  extremeOversold: 20,
  extremeOverbought: 80,
};

// Cache for RSI readings to avoid excessive API calls
interface CacheEntry {
  reading: RSIReading;
  timestamp: number;
}

const rsiCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch RSI for a single token
 */
async function fetchTokenRSI(
  symbol: string,
  address: string,
  name: string,
  timeframe: '1H' | '4H' | '1D' = '4H'
): Promise<RSIReading | null> {
  // Check cache first
  const cacheKey = `${symbol}-${timeframe}`;
  const cached = rsiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.reading;
  }

  try {
    // Fetch OHLCV data using Birdeye
    const ohlcv = await getOHLCV(address, timeframe);
    
    if (!ohlcv || ohlcv.length < 15) {
      console.warn(`[RSIScanner] Insufficient data for ${symbol}`);
      return null;
    }

    // Calculate RSI
    const rsiResult = calculateRSIFromOHLCV(ohlcv);
    
    // Get current price from latest candle
    const latestCandle = ohlcv[ohlcv.length - 1];
    const previousCandle = ohlcv.length > 24 ? ohlcv[ohlcv.length - 25] : ohlcv[0];
    const priceChange24h = previousCandle 
      ? ((latestCandle.close - previousCandle.close) / previousCandle.close) * 100 
      : 0;

    // Calculate 24h volume
    const last24Candles = ohlcv.slice(-24);
    const volume24h = last24Candles.reduce((sum, c) => sum + c.volume, 0);

    const reading: RSIReading = {
      symbol,
      address,
      name,
      rsi: rsiResult.value,
      signal: rsiResult.signal,
      price: latestCandle.close,
      priceChange24h,
      volume24h,
      lastUpdated: new Date().toISOString(),
      source: 'internal',
    };

    // Update cache
    rsiCache.set(cacheKey, { reading, timestamp: Date.now() });

    return reading;
  } catch (error) {
    console.error(`[RSIScanner] Error fetching RSI for ${symbol}:`, error);
    return null;
  }
}

/**
 * Scan all tracked tokens for RSI levels
 */
export async function scanAllTokensRSI(
  timeframe: '1H' | '4H' | '1D' = '4H',
  thresholds: RSIThresholds = DEFAULT_RSI_THRESHOLDS
): Promise<OversoldScanResult> {
  console.log(`[RSIScanner] Scanning ${TRACKED_TOKENS.length} tokens for RSI...`);
  
  const readings: RSIReading[] = [];
  
  // Process tokens with rate limiting
  for (const token of TRACKED_TOKENS) {
    const reading = await fetchTokenRSI(token.symbol, token.address, token.name, timeframe);
    if (reading) {
      readings.push(reading);
    }
    // Rate limit: 200ms between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Categorize by RSI levels
  const oversold = readings
    .filter(r => r.rsi <= thresholds.oversold)
    .sort((a, b) => a.rsi - b.rsi); // Most oversold first

  const overbought = readings
    .filter(r => r.rsi >= thresholds.overbought)
    .sort((a, b) => b.rsi - a.rsi); // Most overbought first

  const neutral = readings.filter(
    r => r.rsi > thresholds.oversold && r.rsi < thresholds.overbought
  );

  console.log(`[RSIScanner] Scan complete: ${oversold.length} oversold, ${overbought.length} overbought, ${neutral.length} neutral`);

  return {
    oversold,
    overbought,
    neutral,
    scanTime: new Date().toISOString(),
    tokensScanned: readings.length,
    source: 'internal',
  };
}

/**
 * Get oversold tokens only
 */
export async function getOversoldTokens(
  timeframe: '1H' | '4H' | '1D' = '4H',
  threshold: number = 30
): Promise<RSIReading[]> {
  const result = await scanAllTokensRSI(timeframe, {
    ...DEFAULT_RSI_THRESHOLDS,
    oversold: threshold,
  });
  return result.oversold;
}

/**
 * Get overbought tokens only
 */
export async function getOverboughtTokens(
  timeframe: '1H' | '4H' | '1D' = '4H',
  threshold: number = 70
): Promise<RSIReading[]> {
  const result = await scanAllTokensRSI(timeframe, {
    ...DEFAULT_RSI_THRESHOLDS,
    overbought: threshold,
  });
  return result.overbought;
}

/**
 * Calculate signal strength from RSI reading
 * Returns a boost to add to signal confidence
 */
export function calculateRSISignalStrength(
  reading: RSIReading,
  thresholds: RSIThresholds = DEFAULT_RSI_THRESHOLDS
): RSISignalStrength | null {
  const { rsi, symbol } = reading;

  // Not a tradeable signal
  if (rsi > thresholds.oversold && rsi < thresholds.overbought) {
    return null;
  }

  if (rsi <= thresholds.extremeOversold) {
    return {
      symbol,
      rsiValue: rsi,
      signalType: 'OVERSOLD',
      strength: 'EXTREME',
      suggestedAction: 'LONG',
      confidenceBoost: 20,
    };
  }

  if (rsi <= thresholds.oversold) {
    return {
      symbol,
      rsiValue: rsi,
      signalType: 'OVERSOLD',
      strength: rsi <= 25 ? 'MODERATE' : 'WEAK',
      suggestedAction: 'LONG',
      confidenceBoost: rsi <= 25 ? 15 : 10,
    };
  }

  if (rsi >= thresholds.extremeOverbought) {
    return {
      symbol,
      rsiValue: rsi,
      signalType: 'OVERBOUGHT',
      strength: 'EXTREME',
      suggestedAction: 'SHORT',
      confidenceBoost: 20,
    };
  }

  if (rsi >= thresholds.overbought) {
    return {
      symbol,
      rsiValue: rsi,
      signalType: 'OVERBOUGHT',
      strength: rsi >= 75 ? 'MODERATE' : 'WEAK',
      suggestedAction: 'SHORT',
      confidenceBoost: rsi >= 75 ? 15 : 10,
    };
  }

  return null;
}

/**
 * Get RSI reading for a specific token
 */
export async function getTokenRSI(
  symbol: string,
  timeframe: '1H' | '4H' | '1D' = '4H'
): Promise<RSIReading | null> {
  const token = TRACKED_TOKENS.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
  
  if (!token) {
    console.warn(`[RSIScanner] Token ${symbol} not found in tracked list`);
    return null;
  }

  return fetchTokenRSI(token.symbol, token.address, token.name, timeframe);
}

/**
 * Clear the RSI cache
 */
export function clearRSICache(): void {
  rsiCache.clear();
  console.log('[RSIScanner] Cache cleared');
}

/**
 * Get cache status
 */
export function getCacheStatus(): { entries: number; tokens: string[] } {
  return {
    entries: rsiCache.size,
    tokens: Array.from(rsiCache.keys()),
  };
}
