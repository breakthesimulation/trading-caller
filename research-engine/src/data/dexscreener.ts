// DexScreener API Integration (FREE) for Solana Token Analytics

import type { OHLCV } from '../signals/types.js';

const DEXSCREENER_API = 'https://api.dexscreener.com/latest';

export interface DexScreenerPair {
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
    h24: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    m5: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  marketCap: number;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  pairAddress: string;
}

/**
 * Search for tokens by symbol or address
 */
export async function searchTokens(query: string): Promise<TokenInfo[]> {
  try {
    const response = await fetch(`${DEXSCREENER_API}/dex/search?q=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      console.error(`DexScreener search error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (!data.pairs) return [];

    // Filter for Solana pairs only
    const solanaPairs = data.pairs.filter((p: DexScreenerPair) => p.chainId === 'solana');

    return solanaPairs.map((p: DexScreenerPair) => ({
      address: p.baseToken.address,
      symbol: p.baseToken.symbol,
      name: p.baseToken.name,
      price: parseFloat(p.priceUsd) || 0,
      priceChange24h: p.priceChange?.h24 || 0,
      volume24h: p.volume?.h24 || 0,
      marketCap: p.marketCap || p.fdv || 0,
      liquidity: p.liquidity?.usd || 0,
      pairAddress: p.pairAddress,
    }));
  } catch (error) {
    console.error('Error searching DexScreener:', error);
    return [];
  }
}

/**
 * Get token pairs by token address
 */
export async function getTokenPairs(address: string): Promise<DexScreenerPair[]> {
  try {
    const response = await fetch(`${DEXSCREENER_API}/dex/tokens/${address}`);
    
    if (!response.ok) {
      console.error(`DexScreener token error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (!data.pairs) return [];

    // Filter for Solana and sort by liquidity
    return data.pairs
      .filter((p: DexScreenerPair) => p.chainId === 'solana')
      .sort((a: DexScreenerPair, b: DexScreenerPair) => 
        (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      );
  } catch (error) {
    console.error('Error fetching token pairs:', error);
    return [];
  }
}

/**
 * Get token price and info
 */
export async function getTokenPrice(address: string): Promise<number | null> {
  try {
    const pairs = await getTokenPairs(address);
    if (pairs.length === 0) return null;
    
    // Use the most liquid pair
    return parseFloat(pairs[0].priceUsd) || null;
  } catch (error) {
    console.error('Error fetching price:', error);
    return null;
  }
}

/**
 * Get token overview
 * FIXED: Ensure we return the correct token, not the quote token (USDC/USDT)
 */
export async function getTokenOverview(address: string): Promise<TokenInfo | null> {
  try {
    const pairs = await getTokenPairs(address);
    if (pairs.length === 0) return null;
    
    const p = pairs[0]; // Most liquid pair
    
    // CRITICAL FIX: Determine which token in the pair matches our input address
    // Sometimes baseToken is USDC/USDT and we want the quoteToken, and vice versa
    const targetToken = p.baseToken.address.toLowerCase() === address.toLowerCase() 
      ? p.baseToken 
      : p.quoteToken;
    
    // If neither matches (shouldn't happen), fall back to baseToken
    const token = targetToken.address.toLowerCase() === address.toLowerCase() 
      ? targetToken 
      : p.baseToken;
    
    return {
      address: address, // Use the input address to ensure consistency
      symbol: token.symbol,
      name: token.name,
      price: parseFloat(p.priceUsd) || 0,
      priceChange24h: p.priceChange?.h24 || 0,
      volume24h: p.volume?.h24 || 0,
      marketCap: p.marketCap || p.fdv || 0,
      liquidity: p.liquidity?.usd || 0,
      pairAddress: p.pairAddress,
    };
  } catch (error) {
    console.error('Error fetching token overview:', error);
    return null;
  }
}

/**
 * Get top Solana tokens by volume
 * Note: DexScreener doesn't have a direct "top tokens" endpoint,
 * so we search for popular tokens
 */
export async function getTopTokens(limit: number = 50): Promise<TokenInfo[]> {
  // Popular Solana token symbols to search
  const popularSymbols = [
    'SOL', 'BONK', 'WIF', 'JUP', 'PYTH', 'JTO', 'RNDR', 'HNT',
    'RAY', 'ORCA', 'MNGO', 'STEP', 'COPE', 'FIDA', 'SRM',
    'SAMO', 'BOME', 'POPCAT', 'MEW', 'SLERF', 'WEN', 'MYRO'
  ];

  const tokens: TokenInfo[] = [];

  for (const symbol of popularSymbols.slice(0, Math.min(limit, popularSymbols.length))) {
    try {
      const results = await searchTokens(symbol);
      if (results.length > 0) {
        // Get highest liquidity result
        const best = results.sort((a, b) => b.liquidity - a.liquidity)[0];
        if (!tokens.find(t => t.address === best.address)) {
          tokens.push(best);
        }
      }
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      continue;
    }
  }

  return tokens.sort((a, b) => b.marketCap - a.marketCap).slice(0, limit);
}

/**
 * Get OHLCV data from DexScreener chart endpoint
 * Note: DexScreener's OHLCV requires pair address, not token address
 */
export async function getOHLCV(
  pairAddress: string,
  _timeframe: string = '1H' // DexScreener doesn't support timeframe selection in free API
): Promise<OHLCV[]> {
  try {
    // DexScreener chart API (undocumented but works)
    const response = await fetch(
      `https://io.dexscreener.com/dex/chart/amm/v3/solana/${pairAddress}?q=1h`
    );

    if (!response.ok) {
      // Fallback: return empty, caller should use Jupiter for price
      return [];
    }

    const data = await response.json();
    
    if (!data.bars) return [];

    return data.bars.map((bar: any) => ({
      timestamp: bar.timestamp,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume || 0,
    }));
  } catch (error) {
    // DexScreener chart endpoint can be flaky
    return [];
  }
}

/**
 * Get multi-timeframe data (limited in free API)
 */
export async function getMultiTimeframeData(address: string): Promise<{
  token: TokenInfo | null;
  pairs: DexScreenerPair[];
}> {
  const pairs = await getTokenPairs(address);
  const token = pairs.length > 0 ? {
    address: pairs[0].baseToken.address,
    symbol: pairs[0].baseToken.symbol,
    name: pairs[0].baseToken.name,
    price: parseFloat(pairs[0].priceUsd) || 0,
    priceChange24h: pairs[0].priceChange?.h24 || 0,
    volume24h: pairs[0].volume?.h24 || 0,
    marketCap: pairs[0].marketCap || pairs[0].fdv || 0,
    liquidity: pairs[0].liquidity?.usd || 0,
    pairAddress: pairs[0].pairAddress,
  } : null;

  return { token, pairs };
}
