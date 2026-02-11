// GeckoTerminal API Integration (FREE) for Solana OHLCV & Pool Data
// Docs: https://www.geckoterminal.com/dex-api
// Rate limit: 30 req/min — throttled with token bucket

import type { OHLCV } from '../signals/types.js';

const GECKO_TERMINAL_API = 'https://api.geckoterminal.com/api/v2';
const NETWORK = 'solana';

// Rate limiter: 30 requests per 60 seconds
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;

let requestTimestamps: number[] = [];

async function throttle(): Promise<void> {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
  );

  if (requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldestInWindow = requestTimestamps[0];
    const waitMs = RATE_LIMIT_WINDOW_MS - (now - oldestInWindow) + 100;
    console.log(`[GeckoTerminal] Rate limit reached, waiting ${waitMs}ms`);
    await new Promise((r) => setTimeout(r, waitMs));
  }

  requestTimestamps.push(Date.now());
}

// Simple in-memory cache
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute default
const OHLCV_CACHE_TTL_MS = 5 * 60_000; // 5 minutes for OHLCV

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown, ttl = CACHE_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

// ---------- Types ----------

export interface GeckoTerminalPool {
  id: string;
  type: string;
  attributes: {
    name: string;
    address: string;
    base_token_price_usd: string;
    quote_token_price_usd: string;
    base_token_price_native_currency: string;
    fdv_usd: string;
    market_cap_usd: string | null;
    pool_created_at: string;
    reserve_in_usd: string;
    volume_usd: {
      h1: string;
      h6: string;
      h24: string;
    };
    price_change_percentage: {
      h1: string;
      h6: string;
      h24: string;
    };
    transactions: {
      h1: { buys: number; sells: number };
      h24: { buys: number; sells: number };
    };
  };
  relationships: {
    base_token: { data: { id: string } };
    quote_token: { data: { id: string } };
    dex: { data: { id: string } };
  };
}

export interface GeckoTerminalOHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PoolInfo {
  address: string;
  name: string;
  baseTokenId: string;
  quoteTokenId: string;
  dex: string;
  priceUsd: number;
  volume24h: number;
  priceChange24h: number;
  liquidity: number;
  fdv: number;
  marketCap: number;
}

// ---------- API Helpers ----------

async function geckoFetch<T>(path: string): Promise<T | null> {
  await throttle();

  try {
    const url = `${GECKO_TERMINAL_API}${path}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('[GeckoTerminal] Rate limited, backing off 5s');
        await new Promise((r) => setTimeout(r, 5000));
        return null;
      }
      console.error(`[GeckoTerminal] HTTP ${response.status} for ${path}`);
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error(`[GeckoTerminal] Fetch error for ${path}:`, error);
    return null;
  }
}

function parsePool(pool: GeckoTerminalPool): PoolInfo {
  const attrs = pool.attributes;
  return {
    address: attrs.address,
    name: attrs.name,
    baseTokenId: pool.relationships.base_token.data.id,
    quoteTokenId: pool.relationships.quote_token.data.id,
    dex: pool.relationships.dex.data.id,
    priceUsd: parseFloat(attrs.base_token_price_usd) || 0,
    volume24h: parseFloat(attrs.volume_usd?.h24) || 0,
    priceChange24h: parseFloat(attrs.price_change_percentage?.h24) || 0,
    liquidity: parseFloat(attrs.reserve_in_usd) || 0,
    fdv: parseFloat(attrs.fdv_usd) || 0,
    marketCap: parseFloat(attrs.market_cap_usd || '0') || 0,
  };
}

// ---------- Public API ----------

/**
 * Get pools for a Solana token by its mint address
 */
export async function getPoolsForToken(
  tokenAddress: string,
): Promise<PoolInfo[]> {
  const cacheKey = `pools:${tokenAddress}`;
  const cached = getCached<PoolInfo[]>(cacheKey);
  if (cached) return cached;

  const data = await geckoFetch<{ data: GeckoTerminalPool[] }>(
    `/networks/${NETWORK}/tokens/${tokenAddress}/pools?page=1`,
  );

  if (!data?.data) return [];

  const pools = data.data.map(parsePool);
  setCache(cacheKey, pools);
  return pools;
}

/**
 * Get OHLCV candle data for a pool
 * @param poolAddress - The pool/pair address on Solana
 * @param timeframe - 'day' | 'hour' | 'minute'
 * @param aggregate - Number of units per candle (e.g. 4 for 4-hour)
 * @param limit - Number of candles (max 1000)
 */
export async function getOHLCV(
  poolAddress: string,
  timeframe: 'day' | 'hour' | 'minute' = 'hour',
  aggregate: number = 1,
  limit: number = 200,
): Promise<OHLCV[]> {
  const cacheKey = `ohlcv:${poolAddress}:${timeframe}:${aggregate}:${limit}`;
  const cached = getCached<OHLCV[]>(cacheKey);
  if (cached) return cached;

  const data = await geckoFetch<{
    data: {
      attributes: {
        ohlcv_list: number[][];
      };
    };
  }>(
    `/networks/${NETWORK}/pools/${poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}&currency=usd`,
  );

  if (!data?.data?.attributes?.ohlcv_list) return [];

  // GeckoTerminal returns [timestamp, open, high, low, close, volume]
  const candles: OHLCV[] = data.data.attributes.ohlcv_list.map(
    ([timestamp, open, high, low, close, volume]) => ({
      timestamp: timestamp * 1000, // Convert to ms
      open,
      high,
      low,
      close,
      volume,
    }),
  );

  // Sort by timestamp ascending (GeckoTerminal returns newest first)
  candles.sort((a, b) => a.timestamp - b.timestamp);

  setCache(cacheKey, candles, OHLCV_CACHE_TTL_MS);
  return candles;
}

/**
 * Get multi-timeframe OHLCV for a pool (1H, 4H, 1D)
 */
export async function getMultiTimeframeOHLCV(
  poolAddress: string,
): Promise<{ '1H': OHLCV[]; '4H': OHLCV[]; '1D': OHLCV[] }> {
  const [hourly, fourHour, daily] = await Promise.all([
    getOHLCV(poolAddress, 'hour', 1, 168), // 7 days of hourly
    getOHLCV(poolAddress, 'hour', 4, 60), // 10 days of 4H
    getOHLCV(poolAddress, 'day', 1, 90), // 90 days daily
  ]);

  return {
    '1H': hourly,
    '4H': fourHour,
    '1D': daily,
  };
}

/**
 * Get trending Solana pools sorted by volume
 */
export async function getTrendingPools(
  page: number = 1,
): Promise<PoolInfo[]> {
  const cacheKey = `trending:${page}`;
  const cached = getCached<PoolInfo[]>(cacheKey);
  if (cached) return cached;

  const data = await geckoFetch<{ data: GeckoTerminalPool[] }>(
    `/networks/${NETWORK}/trending_pools?page=${page}`,
  );

  if (!data?.data) return [];

  const pools = data.data.map(parsePool);
  setCache(cacheKey, pools);
  return pools;
}

/**
 * Search for pools on Solana
 */
export async function searchPools(query: string): Promise<PoolInfo[]> {
  const cacheKey = `search:${query}`;
  const cached = getCached<PoolInfo[]>(cacheKey);
  if (cached) return cached;

  const data = await geckoFetch<{ data: GeckoTerminalPool[] }>(
    `/search/pools?query=${encodeURIComponent(query)}&network=${NETWORK}`,
  );

  if (!data?.data) return [];

  const pools = data.data.map(parsePool);
  setCache(cacheKey, pools);
  return pools;
}

/**
 * Get token info from GeckoTerminal
 */
export async function getTokenInfo(
  tokenAddress: string,
): Promise<{
  name: string;
  symbol: string;
  address: string;
  priceUsd: number;
  fdv: number;
  volume24h: number;
  totalReserveUsd: number;
} | null> {
  type TokenInfoResult = {
    name: string;
    symbol: string;
    address: string;
    priceUsd: number;
    fdv: number;
    volume24h: number;
    totalReserveUsd: number;
  };

  const cacheKey = `token:${tokenAddress}`;
  const cached = getCached<TokenInfoResult>(cacheKey);
  if (cached) return cached;

  const data = await geckoFetch<{
    data: {
      attributes: {
        name: string;
        symbol: string;
        address: string;
        price_usd: string;
        fdv_usd: string;
        volume_usd: { h24: string };
        total_reserve_in_usd: string;
      };
    };
  }>(`/networks/${NETWORK}/tokens/${tokenAddress}`);

  if (!data?.data?.attributes) return null;

  const attrs = data.data.attributes;
  const result = {
    name: attrs.name,
    symbol: attrs.symbol,
    address: attrs.address,
    priceUsd: parseFloat(attrs.price_usd) || 0,
    fdv: parseFloat(attrs.fdv_usd) || 0,
    volume24h: parseFloat(attrs.volume_usd?.h24) || 0,
    totalReserveUsd: parseFloat(attrs.total_reserve_in_usd) || 0,
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Convenience: Get the best pool for a token (highest liquidity)
 * Then fetch multi-timeframe OHLCV from that pool
 */
export async function getTokenOHLCV(
  tokenAddress: string,
): Promise<{ '1H': OHLCV[]; '4H': OHLCV[]; '1D': OHLCV[] } | null> {
  const pools = await getPoolsForToken(tokenAddress);
  if (pools.length === 0) return null;

  // Pick the pool with highest liquidity
  const bestPool = pools.sort((a, b) => b.liquidity - a.liquidity)[0];
  console.log(
    `[GeckoTerminal] Using pool ${bestPool.name} (${bestPool.address}) for ${tokenAddress}`,
  );

  return getMultiTimeframeOHLCV(bestPool.address);
}

/**
 * Clear the in-memory cache
 */
export function clearCache(): void {
  cache.clear();
  console.log('[GeckoTerminal] Cache cleared');
}
