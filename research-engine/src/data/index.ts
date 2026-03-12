// Data Layer - Unified data fetching with quality filters
// NEVER uses simulated OHLCV — only real market data produces signals

export * from './jupiter.js';
export * from './dexscreener.js';
export {
  getPoolsForToken,
  getOHLCV as getGeckoTerminalPoolOHLCV,
  getMultiTimeframeOHLCV as getGeckoTerminalMultiOHLCV,
  getTrendingPools,
  searchPools as searchGeckoTerminalPools,
  getTokenInfo as getGeckoTerminalTokenInfo,
  getTokenOHLCV as getGeckoTerminalTokenOHLCV,
  clearCache as clearGeckoTerminalCache,
} from './geckoterminal.js';

import type { Token, OHLCV, MarketData } from '../signals/types.js';
import {
  getPrice,
  getPrices,
  KNOWN_TOKENS,
  getTopJupiterTokens,
  extractMarketMetrics,
  type JupiterTokenData,
  type JupiterMarketMetrics,
} from './jupiter.js';
import {
  getTokenOverview,
  getTopTokens,
  getOHLCV as getDexScreenerOHLCV,
} from './dexscreener.js';
import {
  getMultiTimeframeOHLCV as getBirdeyeMultiOHLCV,
} from './birdeye.js';
import {
  getTokenOHLCV as getGeckoTerminalOHLCV,
} from './geckoterminal.js';

// --- Quality thresholds ---
// Only generate signals for tokens meeting these minimum requirements
const MIN_LIQUIDITY_USD = 500_000;
const MIN_MARKET_CAP_USD = 5_000_000;
const MIN_OHLCV_CANDLES = 35;

const hasBirdeyeKey = () => !!process.env.BIRDEYE_API_KEY;

export interface MarketQuality {
  hasMinimumLiquidity: boolean;
  hasMinimumMarketCap: boolean;
  hasRealOHLCV: boolean;
  isSuspicious: boolean;
  isValid: boolean;
  rejectionReason: string | null;
}

/**
 * Validate that market data meets quality thresholds for signal generation
 */
export function validateMarketQuality(
  marketCap: number,
  liquidity: number,
  ohlcvCandleCount: number,
  isSuspicious: boolean = false,
): MarketQuality {
  const hasMinimumLiquidity = liquidity >= MIN_LIQUIDITY_USD;
  const hasMinimumMarketCap = marketCap >= MIN_MARKET_CAP_USD;
  const hasRealOHLCV = ohlcvCandleCount >= MIN_OHLCV_CANDLES;

  let rejectionReason: string | null = null;
  if (isSuspicious) {
    rejectionReason = 'Token flagged as suspicious';
  } else if (!hasMinimumLiquidity) {
    rejectionReason = `Liquidity $${(liquidity / 1000).toFixed(0)}K < $${MIN_LIQUIDITY_USD / 1000}K minimum`;
  } else if (!hasMinimumMarketCap) {
    rejectionReason = `Market cap $${(marketCap / 1_000_000).toFixed(1)}M < $${MIN_MARKET_CAP_USD / 1_000_000}M minimum`;
  } else if (!hasRealOHLCV) {
    rejectionReason = `Only ${ohlcvCandleCount} candles available (need ${MIN_OHLCV_CANDLES})`;
  }

  return {
    hasMinimumLiquidity,
    hasMinimumMarketCap,
    hasRealOHLCV,
    isSuspicious,
    isValid:
      hasMinimumLiquidity &&
      hasMinimumMarketCap &&
      hasRealOHLCV &&
      !isSuspicious,
    rejectionReason,
  };
}

/**
 * Fetch real OHLCV data from available sources
 * Returns empty arrays if no real data available — NEVER simulates
 */
async function fetchOHLCV(
  tokenAddress: string,
  pairAddress?: string,
): Promise<{ '1H': OHLCV[]; '4H': OHLCV[]; '1D': OHLCV[] }> {
  // Try Birdeye first if API key is available (best quality)
  if (hasBirdeyeKey()) {
    try {
      console.log(`[Data] Fetching OHLCV from Birdeye for ${tokenAddress}`);
      const data = await getBirdeyeMultiOHLCV(tokenAddress);
      if (data['4H'].length >= MIN_OHLCV_CANDLES) {
        console.log(`[Data] Got ${data['4H'].length} candles from Birdeye`);
        return data;
      }
    } catch (error) {
      console.log('[Data] Birdeye OHLCV failed, trying GeckoTerminal');
    }
  }

  // Try GeckoTerminal (free, real OHLCV)
  try {
    console.log(`[Data] Fetching OHLCV from GeckoTerminal for ${tokenAddress}`);
    const data = await getGeckoTerminalOHLCV(tokenAddress);
    if (data && data['4H'].length >= MIN_OHLCV_CANDLES) {
      console.log(`[Data] Got ${data['4H'].length} 4H candles from GeckoTerminal`);
      return data;
    }
  } catch (error) {
    console.log('[Data] GeckoTerminal OHLCV failed, trying DexScreener');
  }

  // Try DexScreener chart endpoint
  if (pairAddress) {
    try {
      console.log(`[Data] Fetching OHLCV from DexScreener for pair ${pairAddress}`);
      const hourlyData = await getDexScreenerOHLCV(pairAddress, '1H');
      if (hourlyData.length >= MIN_OHLCV_CANDLES) {
        console.log(`[Data] Got ${hourlyData.length} candles from DexScreener`);
        const fourHourData = aggregateCandles(hourlyData, 4);
        const dailyData = aggregateCandles(hourlyData, 24);
        return {
          '1H': hourlyData.slice(-168),
          '4H': fourHourData,
          '1D': dailyData,
        };
      }
    } catch (error) {
      console.log('[Data] DexScreener OHLCV failed');
    }
  }

  // No real data available — return empty (NEVER simulate)
  console.warn(`[Data] No real OHLCV data available for ${tokenAddress} — skipping`);
  return { '1H': [], '4H': [], '1D': [] };
}

/**
 * Aggregate candles to higher timeframe
 */
function aggregateCandles(candles: OHLCV[], factor: number): OHLCV[] {
  const result: OHLCV[] = [];
  for (let i = 0; i < candles.length; i += factor) {
    const chunk = candles.slice(i, i + factor);
    if (chunk.length === 0) continue;
    result.push({
      timestamp: chunk[0].timestamp,
      open: chunk[0].open,
      high: Math.max(...chunk.map((c) => c.high)),
      low: Math.min(...chunk.map((c) => c.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((sum, c) => sum + c.volume, 0),
    });
  }
  return result;
}

/**
 * Get complete market data for a token with quality validation
 */
export async function getMarketData(
  tokenAddress: string,
): Promise<MarketData | null> {
  try {
    const [price, overview] = await Promise.all([
      getPrice(tokenAddress),
      getTokenOverview(tokenAddress),
    ]);

    if (!price && !overview) {
      return null;
    }

    const token: Token = {
      symbol: overview?.symbol || 'UNKNOWN',
      name: overview?.name || 'Unknown Token',
      address: tokenAddress,
      decimals: 9,
    };

    const currentPrice = price || overview?.price || 0;
    const priceChange = overview?.priceChange24h || 0;
    const pairAddress = overview?.pairAddress;

    // Fetch real OHLCV data — no simulation fallback
    const ohlcv = await fetchOHLCV(tokenAddress, pairAddress);

    return {
      token,
      price: currentPrice,
      priceChange24h: priceChange,
      volume24h: overview?.volume24h || 0,
      marketCap: overview?.marketCap || 0,
      ohlcv,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error fetching market data for ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Get enriched market data using Jupiter Token API v2
 * Returns market data plus Jupiter-specific metrics (buy/sell pressure, organic score)
 */
export async function getEnrichedMarketData(
  tokenData: JupiterTokenData,
): Promise<{
  marketData: MarketData;
  metrics: JupiterMarketMetrics;
  quality: MarketQuality;
} | null> {
  const metrics = extractMarketMetrics(tokenData);
  if (!metrics) return null;

  const token: Token = {
    symbol: tokenData.symbol,
    name: tokenData.name,
    address: tokenData.id,
    decimals: tokenData.decimals,
  };

  // Fetch OHLCV
  const ohlcv = await fetchOHLCV(tokenData.id);

  // Validate quality
  const quality = validateMarketQuality(
    metrics.marketCap,
    metrics.liquidity,
    ohlcv['4H'].length,
    metrics.isSuspicious,
  );

  const marketData: MarketData = {
    token,
    price: metrics.price,
    priceChange24h: metrics.priceChange24h,
    volume24h: metrics.volume24h,
    marketCap: metrics.marketCap,
    ohlcv,
    lastUpdated: new Date().toISOString(),
  };

  return { marketData, metrics, quality };
}

/**
 * Get market data for multiple tokens
 */
export async function getBatchMarketData(
  tokenAddresses: string[],
): Promise<Map<string, MarketData>> {
  const results = new Map<string, MarketData>();

  // Batch price fetch from Jupiter
  await getPrices(tokenAddresses);

  for (const address of tokenAddresses) {
    try {
      const data = await getMarketData(address);
      if (data) {
        results.set(address, data);
      }
      // Rate limit — be nice to free APIs
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`Error fetching data for ${address}:`, error);
    }
  }

  return results;
}

/**
 * Get watchlist tokens from Jupiter's top traded/trending
 */
export async function getWatchlistTokens(
  limit: number = 50,
): Promise<Token[]> {
  const tokens: Token[] = [];

  // Add known tokens first
  for (const token of Object.values(KNOWN_TOKENS)) {
    tokens.push(token);
  }

  // Get top traded tokens from Jupiter Token API v2
  try {
    const topTraded = await getTopJupiterTokens('toptraded', '1h', limit);
    for (const t of topTraded) {
      if (tokens.some((existing) => existing.address === t.id)) continue;
      tokens.push({
        symbol: t.symbol,
        name: t.name,
        address: t.id,
        decimals: t.decimals,
      });
    }
  } catch (error) {
    console.error('[Data] Error fetching Jupiter top tokens:', error);
  }

  return tokens.slice(0, limit);
}

/**
 * Simple cache for market data
 */
class MarketDataCache {
  private cache: Map<string, { data: MarketData; timestamp: number }> =
    new Map();
  private ttlMs: number;

  constructor(ttlMs: number = 60000) {
    this.ttlMs = ttlMs;
  }

  get(address: string): MarketData | null {
    const entry = this.cache.get(address);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(address);
      return null;
    }
    return entry.data;
  }

  set(address: string, data: MarketData): void {
    this.cache.set(address, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const marketDataCache = new MarketDataCache();
