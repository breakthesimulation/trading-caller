// Jupiter API Integration for Solana
// Uses Jupiter Price API v3 for real-time prices
// Uses Jupiter Token API v2 for token discovery and market metrics

import type { Token, OHLCV } from '../signals/types.js';

// Jupiter API endpoints
const JUPITER_PRICE_API = 'https://api.jup.ag/price/v3';
const JUPITER_TOKEN_API = 'https://api.jup.ag/tokens/v2';
const DEXSCREENER_API = 'https://api.dexscreener.com/latest';

// Jupiter API key (optional, get free key from portal.jup.ag)
const JUPITER_API_KEY = process.env.JUPITER_API_KEY || '';

// Rate limiter: 60 requests per 60 seconds (free tier)
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 55; // Leave headroom
let requestTimestamps: number[] = [];

async function throttle(): Promise<void> {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
  );
  if (requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldestInWindow = requestTimestamps[0];
    const waitMs = RATE_LIMIT_WINDOW_MS - (now - oldestInWindow) + 200;
    console.log(`[Jupiter] Rate limit approaching, waiting ${waitMs}ms`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
  requestTimestamps.push(Date.now());
}

// Simple in-memory cache
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const PRICE_CACHE_TTL_MS = 30_000; // 30 seconds for prices
const TOKEN_LIST_CACHE_TTL_MS = 5 * 60_000; // 5 minutes for token lists

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown, ttl: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

// Common Solana token addresses
export const KNOWN_TOKENS: Record<string, Token> = {
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    address: 'So11111111111111111111111111111111111111112',
    decimals: 9,
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
  },
  JUP: {
    symbol: 'JUP',
    name: 'Jupiter',
    address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    decimals: 6,
  },
  RAY: {
    symbol: 'RAY',
    name: 'Raydium',
    address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    decimals: 6,
  },
  PYTH: {
    symbol: 'PYTH',
    name: 'Pyth Network',
    address: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
    decimals: 6,
  },
  JTO: {
    symbol: 'JTO',
    name: 'Jito',
    address: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
    decimals: 9,
  },
  ORCA: {
    symbol: 'ORCA',
    name: 'Orca',
    address: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
    decimals: 6,
  },
  HNT: {
    symbol: 'HNT',
    name: 'Helium',
    address: 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux',
    decimals: 8,
  },
  RNDR: {
    symbol: 'RNDR',
    name: 'Render',
    address: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',
    decimals: 8,
  },
  BONK: {
    symbol: 'BONK',
    name: 'Bonk',
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    decimals: 5,
  },
  WIF: {
    symbol: 'WIF',
    name: 'dogwifhat',
    address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    decimals: 6,
  },
  POPCAT: {
    symbol: 'POPCAT',
    name: 'Popcat',
    address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
    decimals: 9,
  },
  TRUMP: {
    symbol: 'TRUMP',
    name: 'Official Trump',
    address: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN',
    decimals: 9,
  },
  PENGU: {
    symbol: 'PENGU',
    name: 'Pudgy Penguins',
    address: '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv',
    decimals: 6,
  },
};

// --- Jupiter Token API v2 response types ---

export interface JupiterTokenData {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  icon: string;
  usdPrice: number | null;
  fdv: number | null;
  mcap: number | null;
  liquidity: number | null;
  holderCount: number | null;
  organicScore: number | null;
  isVerified: boolean;
  audit?: {
    mintAuthorityDisabled: boolean;
    freezeAuthorityDisabled: boolean;
    topHoldersPercentage: number;
    isSus: boolean;
  };
  stats?: {
    '5m'?: JupiterTimeframeStats;
    '1h'?: JupiterTimeframeStats;
    '6h'?: JupiterTimeframeStats;
    '24h'?: JupiterTimeframeStats;
  };
}

interface JupiterTimeframeStats {
  priceChange: number | null;
  volumeChange: number | null;
  buyVolume: number | null;
  sellVolume: number | null;
  numBuys: number | null;
  numSells: number | null;
  numTraders: number | null;
  numNetBuyers: number | null;
}

export interface JupiterMarketMetrics {
  price: number;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  priceChange1h: number;
  priceChange24h: number;
  buyVolume24h: number;
  sellVolume24h: number;
  buyPressureRatio: number; // buyVolume / (buyVolume + sellVolume)
  organicScore: number;
  isVerified: boolean;
  isSuspicious: boolean;
}

// --- Jupiter Price API v3 ---

/**
 * Get current price for a single token.
 * Tries Jupiter Price API v3 first (requires API key), falls back to DexScreener.
 */
export async function getPrice(tokenAddress: string): Promise<number | null> {
  const cacheKey = `price:${tokenAddress}`;
  const cached = getCached<number>(cacheKey);
  if (cached !== null) return cached;

  // Try Jupiter Price API v3 if we have an API key
  if (JUPITER_API_KEY) {
    await throttle();
    try {
      const response = await fetch(
        `${JUPITER_PRICE_API}?ids=${tokenAddress}`,
        { headers: { 'x-api-key': JUPITER_API_KEY } },
      );

      if (response.ok) {
        const data = await response.json() as {
          data: Record<string, { usdPrice: number | null }>;
        };
        const tokenData = data.data?.[tokenAddress];
        if (tokenData?.usdPrice) {
          setCache(cacheKey, tokenData.usdPrice, PRICE_CACHE_TTL_MS);
          return tokenData.usdPrice;
        }
      }
    } catch (error) {
      // Fall through to DexScreener
    }
  }

  // Fallback: DexScreener (free, no key required)
  try {
    const response = await fetch(
      `${DEXSCREENER_API}/dex/tokens/${tokenAddress}`,
    );
    if (!response.ok) return null;

    const data = await response.json() as {
      pairs?: Array<{
        chainId: string;
        priceUsd: string;
        liquidity?: { usd: number };
      }>;
    };

    const solanaPairs = data.pairs?.filter((p) => p.chainId === 'solana') || [];
    if (solanaPairs.length === 0) return null;

    // Use the most liquid pair for best price
    solanaPairs.sort(
      (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0),
    );

    const price = parseFloat(solanaPairs[0].priceUsd) || null;
    if (price) setCache(cacheKey, price, PRICE_CACHE_TTL_MS);
    return price;
  } catch (error) {
    console.error('[Jupiter] Error fetching price:', error);
    return null;
  }
}

/**
 * Get prices for multiple tokens.
 * Uses Jupiter batch API if key available, otherwise falls back to individual DexScreener calls.
 */
export async function getPrices(
  tokenAddresses: string[],
): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  const MAX_BATCH_SIZE = 50;

  // Try Jupiter batch if API key available
  if (JUPITER_API_KEY) {
    for (let i = 0; i < tokenAddresses.length; i += MAX_BATCH_SIZE) {
      const batch = tokenAddresses.slice(i, i + MAX_BATCH_SIZE);
      const ids = batch.join(',');

      const cacheKey = `prices:${ids}`;
      const cached = getCached<Record<string, number>>(cacheKey);
      if (cached) {
        Object.assign(prices, cached);
        continue;
      }

      await throttle();

      try {
        const response = await fetch(`${JUPITER_PRICE_API}?ids=${ids}`, {
          headers: { 'x-api-key': JUPITER_API_KEY },
        });

        if (response.ok) {
          const data = await response.json() as {
            data: Record<string, { usdPrice: number | null }>;
          };

          const batchPrices: Record<string, number> = {};
          for (const [address, info] of Object.entries(data.data || {})) {
            if (info?.usdPrice) {
              batchPrices[address] = info.usdPrice;
            }
          }

          Object.assign(prices, batchPrices);
          setCache(cacheKey, batchPrices, PRICE_CACHE_TTL_MS);
        }
      } catch (error) {
        // Fall through to individual fetches
      }
    }

    if (Object.keys(prices).length > 0) return prices;
  }

  // Fallback: fetch individually via DexScreener
  for (const address of tokenAddresses) {
    try {
      const price = await getPrice(address);
      if (price !== null) {
        prices[address] = price;
      }
      await new Promise((r) => setTimeout(r, 200));
    } catch {
      continue;
    }
  }

  return prices;
}

// --- Jupiter Token API v2 ---

/**
 * Get top tokens by category from Jupiter Token API v2
 * Categories: toptraded, toptrending, toporganicscore
 * Intervals: 5m, 1h, 6h, 24h
 */
export async function getTopJupiterTokens(
  category: 'toptraded' | 'toptrending' | 'toporganicscore' = 'toptraded',
  interval: '5m' | '1h' | '6h' | '24h' = '1h',
  limit: number = 50,
): Promise<JupiterTokenData[]> {
  const cacheKey = `top:${category}:${interval}:${limit}`;
  const cached = getCached<JupiterTokenData[]>(cacheKey);
  if (cached) return cached;

  await throttle();

  try {
    const response = await fetch(
      `${JUPITER_TOKEN_API}/${category}/${interval}?limit=${limit}`,
    );

    if (!response.ok) {
      console.error(`[Jupiter] Token API error: ${response.status}`);
      return [];
    }

    const data = await response.json() as JupiterTokenData[];
    setCache(cacheKey, data, TOKEN_LIST_CACHE_TTL_MS);
    return data;
  } catch (error) {
    console.error('[Jupiter] Error fetching top tokens:', error);
    return [];
  }
}

/**
 * Search for a token by mint address or symbol
 */
export async function searchJupiterToken(
  query: string,
): Promise<JupiterTokenData[]> {
  const cacheKey = `search:${query}`;
  const cached = getCached<JupiterTokenData[]>(cacheKey);
  if (cached) return cached;

  await throttle();

  try {
    const response = await fetch(
      `${JUPITER_TOKEN_API}/search?query=${encodeURIComponent(query)}`,
    );

    if (!response.ok) return [];

    const data = await response.json() as JupiterTokenData[];
    setCache(cacheKey, data, TOKEN_LIST_CACHE_TTL_MS);
    return data;
  } catch (error) {
    console.error('[Jupiter] Search error:', error);
    return [];
  }
}

/**
 * Extract market metrics from Jupiter token data
 * Provides buy/sell pressure, organic score, liquidity — data not available from DexScreener
 */
export function extractMarketMetrics(
  tokenData: JupiterTokenData,
): JupiterMarketMetrics | null {
  if (!tokenData.usdPrice) return null;

  const stats24h = tokenData.stats?.['24h'];
  const stats1h = tokenData.stats?.['1h'];

  const buyVolume24h = stats24h?.buyVolume ?? 0;
  const sellVolume24h = stats24h?.sellVolume ?? 0;
  const totalVolume24h = buyVolume24h + sellVolume24h;

  return {
    price: tokenData.usdPrice,
    marketCap: tokenData.mcap ?? tokenData.fdv ?? 0,
    liquidity: tokenData.liquidity ?? 0,
    volume24h: totalVolume24h,
    priceChange1h: stats1h?.priceChange ?? 0,
    priceChange24h: stats24h?.priceChange ?? 0,
    buyVolume24h,
    sellVolume24h,
    buyPressureRatio: totalVolume24h > 0
      ? buyVolume24h / totalVolume24h
      : 0.5,
    organicScore: tokenData.organicScore ?? 0,
    isVerified: tokenData.isVerified,
    isSuspicious: tokenData.audit?.isSus ?? false,
  };
}

/**
 * Get token info by address
 */
export async function getTokenInfo(
  tokenAddress: string,
): Promise<Token | null> {
  // Check known tokens first
  for (const token of Object.values(KNOWN_TOKENS)) {
    if (token.address === tokenAddress) {
      return token;
    }
  }

  try {
    const results = await searchJupiterToken(tokenAddress);
    if (results.length === 0) return null;

    const found = results[0];
    return {
      symbol: found.symbol,
      name: found.name,
      address: found.id,
      decimals: found.decimals,
    };
  } catch (error) {
    console.error('[Jupiter] Error fetching token info:', error);
    return null;
  }
}

/**
 * Get all tradeable tokens — known tokens + top traded from Jupiter
 */
export async function getAllTokens(): Promise<Token[]> {
  const tokens: Token[] = Object.values(KNOWN_TOKENS);

  try {
    const topTraded = await getTopJupiterTokens('toptraded', '1h', 30);
    for (const t of topTraded) {
      if (!tokens.some((existing) => existing.address === t.id)) {
        tokens.push({
          symbol: t.symbol,
          name: t.name,
          address: t.id,
          decimals: t.decimals,
        });
      }
    }
  } catch (error) {
    console.error('[Jupiter] Error fetching tradeable tokens:', error);
  }

  return tokens;
}

/**
 * Clear the in-memory cache
 */
export function clearJupiterCache(): void {
  cache.clear();
  console.log('[Jupiter] Cache cleared');
}
