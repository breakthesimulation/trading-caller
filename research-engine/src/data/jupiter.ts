// Jupiter API Integration for Solana Price Data

import type { Token, OHLCV } from '../signals/types.js';

const JUPITER_PRICE_API = 'https://price.jup.ag/v6';
const JUPITER_API = 'https://api.jup.ag';

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
};

export interface JupiterPriceResponse {
  data: {
    [address: string]: {
      id: string;
      mintSymbol: string;
      vsToken: string;
      vsTokenSymbol: string;
      price: number;
    };
  };
  timeTaken: number;
}

/**
 * Get current price for a token from Jupiter
 */
export async function getPrice(tokenAddress: string): Promise<number | null> {
  try {
    const response = await fetch(
      `${JUPITER_PRICE_API}/price?ids=${tokenAddress}`
    );
    
    if (!response.ok) {
      console.error(`Jupiter price API error: ${response.status}`);
      return null;
    }

    const data: JupiterPriceResponse = await response.json();
    return data.data[tokenAddress]?.price || null;
  } catch (error) {
    console.error('Error fetching Jupiter price:', error);
    return null;
  }
}

/**
 * Get prices for multiple tokens
 */
export async function getPrices(tokenAddresses: string[]): Promise<Record<string, number>> {
  try {
    const ids = tokenAddresses.join(',');
    const response = await fetch(`${JUPITER_PRICE_API}/price?ids=${ids}`);
    
    if (!response.ok) {
      console.error(`Jupiter price API error: ${response.status}`);
      return {};
    }

    const data: JupiterPriceResponse = await response.json();
    const prices: Record<string, number> = {};
    
    for (const [address, info] of Object.entries(data.data)) {
      prices[address] = info.price;
    }
    
    return prices;
  } catch (error) {
    console.error('Error fetching Jupiter prices:', error);
    return {};
  }
}

/**
 * Get token info from Jupiter
 */
export async function getTokenInfo(tokenAddress: string): Promise<Token | null> {
  // Check known tokens first
  for (const token of Object.values(KNOWN_TOKENS)) {
    if (token.address === tokenAddress) {
      return token;
    }
  }

  try {
    const response = await fetch(`${JUPITER_API}/tokens/v1/${tokenAddress}`);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      symbol: data.symbol,
      name: data.name,
      address: data.address,
      decimals: data.decimals,
    };
  } catch (error) {
    console.error('Error fetching token info:', error);
    return null;
  }
}

/**
 * Get all tradeable tokens from Jupiter
 */
export async function getAllTokens(): Promise<Token[]> {
  try {
    const response = await fetch(`${JUPITER_API}/tokens/v1/all`);
    
    if (!response.ok) {
      console.error(`Jupiter tokens API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.map((t: any) => ({
      symbol: t.symbol,
      name: t.name,
      address: t.address,
      decimals: t.decimals,
    }));
  } catch (error) {
    console.error('Error fetching all tokens:', error);
    return [];
  }
}

/**
 * Get quote for a swap (useful for checking liquidity)
 */
export async function getQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippage: number = 50 // 0.5%
): Promise<any | null> {
  try {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippage.toString(),
    });

    const response = await fetch(`${JUPITER_API}/quote?${params}`);
    
    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching quote:', error);
    return null;
  }
}
