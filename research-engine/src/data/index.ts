// Data Layer - Unified data fetching (FREE APIs only)

export * from './jupiter.js';
export * from './dexscreener.js';

import type { Token, OHLCV, MarketData } from '../signals/types.js';
import { getPrice, getPrices, KNOWN_TOKENS } from './jupiter.js';
import { 
  getTokenOverview, 
  getTopTokens,
  getTokenPairs,
  type TokenInfo 
} from './dexscreener.js';

/**
 * Get complete market data for a token
 */
export async function getMarketData(tokenAddress: string): Promise<MarketData | null> {
  try {
    const [price, overview] = await Promise.all([
      getPrice(tokenAddress),
      getTokenOverview(tokenAddress),
    ]);

    if (!price && !overview) {
      return null;
    }

    // Build token info
    const token: Token = {
      symbol: overview?.symbol || 'UNKNOWN',
      name: overview?.name || 'Unknown Token',
      address: tokenAddress,
      decimals: 9, // Default for Solana tokens
    };

    // Get price data from pairs for OHLCV-like metrics
    const pairs = await getTokenPairs(tokenAddress);
    const mainPair = pairs[0];

    // Build pseudo-OHLCV from available data
    const currentPrice = price || overview?.price || 0;
    const priceChange = overview?.priceChange24h || 0;
    const estimatedOpen = currentPrice / (1 + priceChange / 100);

    const ohlcv: { '1H': OHLCV[]; '4H': OHLCV[]; '1D': OHLCV[] } = {
      '1H': [{
        timestamp: Date.now(),
        open: currentPrice * 0.998,
        high: currentPrice * 1.01,
        low: currentPrice * 0.99,
        close: currentPrice,
        volume: (overview?.volume24h || 0) / 24,
      }],
      '4H': [{
        timestamp: Date.now(),
        open: currentPrice * 0.995,
        high: currentPrice * 1.02,
        low: currentPrice * 0.98,
        close: currentPrice,
        volume: (overview?.volume24h || 0) / 6,
      }],
      '1D': [{
        timestamp: Date.now(),
        open: estimatedOpen,
        high: Math.max(currentPrice, estimatedOpen) * 1.02,
        low: Math.min(currentPrice, estimatedOpen) * 0.98,
        close: currentPrice,
        volume: overview?.volume24h || 0,
      }],
    };

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
 * Get market data for multiple tokens
 */
export async function getBatchMarketData(
  tokenAddresses: string[]
): Promise<Map<string, MarketData>> {
  const results = new Map<string, MarketData>();

  // Batch price fetch from Jupiter
  const prices = await getPrices(tokenAddresses);

  // Fetch individual data (with rate limiting)
  for (const address of tokenAddresses) {
    try {
      const data = await getMarketData(address);
      if (data) {
        results.set(address, data);
      }
      // Rate limit - DexScreener is generous but be nice
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`Error fetching data for ${address}:`, error);
    }
  }

  return results;
}

/**
 * Get watchlist tokens (top tokens + known tokens)
 */
export async function getWatchlistTokens(limit: number = 50): Promise<Token[]> {
  const tokens: Token[] = [];

  // Add known tokens first
  for (const token of Object.values(KNOWN_TOKENS)) {
    tokens.push(token);
  }

  // Get top tokens from DexScreener
  try {
    const topTokens = await getTopTokens(limit);
    
    for (const t of topTokens) {
      // Skip if already in list
      if (tokens.some(existing => existing.address === t.address)) {
        continue;
      }
      
      tokens.push({
        symbol: t.symbol,
        name: t.name,
        address: t.address,
        decimals: 9,
      });
    }
  } catch (error) {
    console.error('Error fetching top tokens:', error);
  }

  return tokens.slice(0, limit);
}

/**
 * Simple cache for market data
 */
class MarketDataCache {
  private cache: Map<string, { data: MarketData; timestamp: number }> = new Map();
  private ttlMs: number;

  constructor(ttlMs: number = 60000) { // Default 1 minute TTL
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
