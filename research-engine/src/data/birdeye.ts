// Birdeye API Integration for Solana Token Analytics

import type { Token, OHLCV } from '../signals/types.js';

const BIRDEYE_API = 'https://public-api.birdeye.so';

// Get API key from environment
const getApiKey = () => process.env.BIRDEYE_API_KEY || '';

export interface BirdeyeTokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  organicScore?: number;
}

export interface BirdeyeOHLCV {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  unixTime: number;
}

/**
 * Get token list from Birdeye (top tokens by market cap)
 */
export async function getTopTokens(
  limit: number = 100,
  offset: number = 0
): Promise<BirdeyeTokenInfo[]> {
  try {
    const response = await fetch(
      `${BIRDEYE_API}/defi/tokenlist?sort_by=mc&sort_type=desc&offset=${offset}&limit=${limit}`,
      {
        headers: {
          'X-API-KEY': getApiKey(),
          'x-chain': 'solana',
        },
      }
    );

    if (!response.ok) {
      console.error(`Birdeye API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (!data.success || !data.data?.tokens) {
      return [];
    }

    return data.data.tokens.map((t: any) => ({
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      price: t.price,
      priceChange24h: t.priceChange24hPercent,
      volume24h: t.volume24hUSD,
      marketCap: t.mc,
      liquidity: t.liquidity,
      organicScore: t.organicScore,
    }));
  } catch (error) {
    console.error('Error fetching Birdeye token list:', error);
    return [];
  }
}

/**
 * Get token price from Birdeye
 */
export async function getTokenPrice(address: string): Promise<number | null> {
  try {
    const response = await fetch(
      `${BIRDEYE_API}/defi/price?address=${address}`,
      {
        headers: {
          'X-API-KEY': getApiKey(),
          'x-chain': 'solana',
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.data?.value || null;
  } catch (error) {
    console.error('Error fetching Birdeye price:', error);
    return null;
  }
}

/**
 * Get OHLCV data from Birdeye
 * @param address Token address
 * @param timeframe '1m' | '5m' | '15m' | '30m' | '1H' | '4H' | '1D' | '1W'
 * @param timeFrom Unix timestamp (seconds)
 * @param timeTo Unix timestamp (seconds)
 */
export async function getOHLCV(
  address: string,
  timeframe: string = '1H',
  timeFrom?: number,
  timeTo?: number
): Promise<OHLCV[]> {
  try {
    // Default to last 7 days
    const now = Math.floor(Date.now() / 1000);
    const from = timeFrom || now - 7 * 24 * 60 * 60;
    const to = timeTo || now;

    const response = await fetch(
      `${BIRDEYE_API}/defi/ohlcv?address=${address}&type=${timeframe}&time_from=${from}&time_to=${to}`,
      {
        headers: {
          'X-API-KEY': getApiKey(),
          'x-chain': 'solana',
        },
      }
    );

    if (!response.ok) {
      console.error(`Birdeye OHLCV API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (!data.success || !data.data?.items) {
      return [];
    }

    return data.data.items.map((item: BirdeyeOHLCV) => ({
      timestamp: item.unixTime * 1000,
      open: item.o,
      high: item.h,
      low: item.l,
      close: item.c,
      volume: item.v,
    }));
  } catch (error) {
    console.error('Error fetching Birdeye OHLCV:', error);
    return [];
  }
}

/**
 * Get token overview (detailed info)
 */
export async function getTokenOverview(address: string): Promise<BirdeyeTokenInfo | null> {
  try {
    const response = await fetch(
      `${BIRDEYE_API}/defi/token_overview?address=${address}`,
      {
        headers: {
          'X-API-KEY': getApiKey(),
          'x-chain': 'solana',
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (!data.success || !data.data) {
      return null;
    }

    const t = data.data;
    return {
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      price: t.price,
      priceChange24h: t.priceChange24hPercent,
      volume24h: t.volume24hUSD,
      marketCap: t.mc,
      liquidity: t.liquidity,
      organicScore: t.organicScore,
    };
  } catch (error) {
    console.error('Error fetching token overview:', error);
    return null;
  }
}

/**
 * Get tokens filtered by criteria (for Tier 2 coverage)
 * - Market cap >= $1M
 * - Organic score >= 63
 */
export async function getQualityTokens(
  minMarketCap: number = 1000000,
  minOrganicScore: number = 63,
  limit: number = 400
): Promise<BirdeyeTokenInfo[]> {
  const allTokens: BirdeyeTokenInfo[] = [];
  let offset = 0;
  const batchSize = 50;

  while (allTokens.length < limit) {
    const batch = await getTopTokens(batchSize, offset);
    
    if (batch.length === 0) break;

    const filtered = batch.filter(
      t => t.marketCap >= minMarketCap && 
           (t.organicScore === undefined || t.organicScore >= minOrganicScore)
    );

    allTokens.push(...filtered);
    offset += batchSize;

    // Safety limit
    if (offset > 1000) break;
  }

  return allTokens.slice(0, limit);
}

/**
 * Get price history for multiple timeframes
 */
export async function getMultiTimeframeOHLCV(
  address: string
): Promise<{ '1H': OHLCV[]; '4H': OHLCV[]; '1D': OHLCV[] }> {
  const now = Math.floor(Date.now() / 1000);

  const [hourly, fourHour, daily] = await Promise.all([
    getOHLCV(address, '1H', now - 7 * 24 * 60 * 60, now),
    getOHLCV(address, '4H', now - 30 * 24 * 60 * 60, now),
    getOHLCV(address, '1D', now - 90 * 24 * 60 * 60, now),
  ]);

  return {
    '1H': hourly,
    '4H': fourHour,
    '1D': daily,
  };
}
