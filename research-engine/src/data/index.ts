// Data Layer - Unified data fetching

export * from './jupiter.js';
export * from './birdeye.js';

import type { Token, OHLCV, MarketData } from '../signals/types.js';
import { getPrice, getPrices, KNOWN_TOKENS } from './jupiter.js';
import { 
  getMultiTimeframeOHLCV, 
  getTokenOverview, 
  getTopTokens,
  type BirdeyeTokenInfo 
} from './birdeye.js';

/**
 * Get complete market data for a token
 */
export async function getMarketData(tokenAddress: string): Promise<MarketData | null> {
  try {
    const [price, overview, ohlcv] = await Promise.all([
      getPrice(tokenAddress),
      getTokenOverview(tokenAddress),
      getMultiTimeframeOHLCV(tokenAddress),
    ]);

    if (!price || !overview) {
      return null;
    }

    // Find token info
    let token: Token = {
      symbol: overview.symbol,
      name: overview.name,
      address: tokenAddress,
      decimals: overview.decimals,
    };

    return {
      token,
      price,
      priceChange24h: overview.priceChange24h,
      volume24h: overview.volume24h,
      marketCap: overview.marketCap,
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

  // Batch price fetch
  const prices = await getPrices(tokenAddresses);

  // Fetch individual data (with rate limiting)
  for (const address of tokenAddresses) {
    try {
      const data = await getMarketData(address);
      if (data) {
        results.set(address, data);
      }
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 200));
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

  // Get top tokens from Birdeye
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
        decimals: t.decimals,
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
