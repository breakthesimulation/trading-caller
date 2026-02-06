// DexScreener API client for volume data

import axios from 'axios';
import type { TrackedToken, VolumeData } from './types.js';

const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex';

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  pairCreatedAt: number;
}

interface DexScreenerTokenResponse {
  schemaVersion: string;
  pairs: DexScreenerPair[] | null;
}

/**
 * Get volume and price data for a token from DexScreener
 */
export async function getVolumeData(token: TrackedToken): Promise<VolumeData | null> {
  try {
    const response = await axios.get<DexScreenerTokenResponse>(
      `${DEXSCREENER_API}/tokens/${token.address}`,
      { timeout: 10000 }
    );

    const pairs = response.data.pairs;
    if (!pairs || pairs.length === 0) {
      console.log(`[DexScreener] No pairs found for ${token.symbol}`);
      return null;
    }

    // Filter to Solana pairs and sort by liquidity
    const solanaPairs = pairs
      .filter(p => p.chainId === 'solana')
      .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));

    if (solanaPairs.length === 0) {
      console.log(`[DexScreener] No Solana pairs found for ${token.symbol}`);
      return null;
    }

    // Use the most liquid pair
    const pair = solanaPairs[0];

    return {
      token,
      pairAddress: pair.pairAddress,
      priceUsd: parseFloat(pair.priceUsd) || 0,
      priceChange1h: pair.priceChange?.h1 || 0,
      priceChange24h: pair.priceChange?.h24 || 0,
      volume1h: pair.volume?.h1 || 0,
      volume24h: pair.volume?.h24 || 0,
      volume6h: pair.volume?.h6 || 0,
      liquidity: pair.liquidity?.usd || 0,
      fdv: pair.fdv || 0,
      txns1h: {
        buys: pair.txns?.h1?.buys || 0,
        sells: pair.txns?.h1?.sells || 0,
      },
      txns24h: {
        buys: pair.txns?.h24?.buys || 0,
        sells: pair.txns?.h24?.sells || 0,
      },
      fetchedAt: new Date(),
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[DexScreener] Error fetching ${token.symbol}:`, error.message);
    } else {
      console.error(`[DexScreener] Error fetching ${token.symbol}:`, error);
    }
    return null;
  }
}

/**
 * Get volume data for multiple tokens
 */
export async function getMultipleVolumeData(
  tokens: TrackedToken[],
  delayMs: number = 200
): Promise<Map<string, VolumeData>> {
  const results = new Map<string, VolumeData>();

  for (const token of tokens) {
    const data = await getVolumeData(token);
    if (data) {
      results.set(token.address, data);
    }
    
    // Rate limiting - be nice to the free API
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Get pair data directly by pair address
 */
export async function getPairData(pairAddress: string): Promise<VolumeData | null> {
  try {
    const response = await axios.get<{ pair: DexScreenerPair }>(
      `${DEXSCREENER_API}/pairs/solana/${pairAddress}`,
      { timeout: 10000 }
    );

    const pair = response.data.pair;
    if (!pair) {
      return null;
    }

    return {
      token: {
        symbol: pair.baseToken.symbol,
        name: pair.baseToken.name,
        address: pair.baseToken.address,
        pairAddress: pair.pairAddress,
      },
      pairAddress: pair.pairAddress,
      priceUsd: parseFloat(pair.priceUsd) || 0,
      priceChange1h: pair.priceChange?.h1 || 0,
      priceChange24h: pair.priceChange?.h24 || 0,
      volume1h: pair.volume?.h1 || 0,
      volume24h: pair.volume?.h24 || 0,
      volume6h: pair.volume?.h6 || 0,
      liquidity: pair.liquidity?.usd || 0,
      fdv: pair.fdv || 0,
      txns1h: {
        buys: pair.txns?.h1?.buys || 0,
        sells: pair.txns?.h1?.sells || 0,
      },
      txns24h: {
        buys: pair.txns?.h24?.buys || 0,
        sells: pair.txns?.h24?.sells || 0,
      },
      fetchedAt: new Date(),
    };
  } catch (error) {
    console.error(`[DexScreener] Error fetching pair ${pairAddress}:`, error);
    return null;
  }
}

/**
 * Build DexScreener URL for a pair
 */
export function getDexScreenerUrl(pairAddress: string): string {
  return `https://dexscreener.com/solana/${pairAddress}`;
}
