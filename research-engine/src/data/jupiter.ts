// Jupiter/Price Data Integration for Solana
// Using DexScreener for prices since Jupiter API now requires auth

import type { Token, OHLCV } from '../signals/types.js';

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
  // Memecoins
  BOME: {
    symbol: 'BOME',
    name: 'Book of Meme',
    address: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',
    decimals: 6,
  },
  POPCAT: {
    symbol: 'POPCAT',
    name: 'Popcat',
    address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
    decimals: 9,
  },
  MEW: {
    symbol: 'MEW',
    name: 'cat in a dogs world',
    address: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
    decimals: 5,
  },
  SLERF: {
    symbol: 'SLERF',
    name: 'Slerf',
    address: '7BgBvyjrZX1YKz4oh9mjb8ZScatkkwb8DzFx7LoiVkM3',
    decimals: 9,
  },
  // DeFi
  MNGO: {
    symbol: 'MNGO',
    name: 'Mango',
    address: 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac',
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
};

const DEXSCREENER_API = 'https://api.dexscreener.com/latest';

/**
 * Get current price for a token using DexScreener
 */
export async function getPrice(tokenAddress: string): Promise<number | null> {
  try {
    const response = await fetch(
      `${DEXSCREENER_API}/dex/tokens/${tokenAddress}`
    );
    
    if (!response.ok) {
      console.error(`DexScreener API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    // Find Solana pairs and get the most liquid one
    const solanaPairs = data.pairs?.filter((p: any) => p.chainId === 'solana') || [];
    
    if (solanaPairs.length === 0) {
      return null;
    }

    // Sort by liquidity and get best price
    solanaPairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    
    return parseFloat(solanaPairs[0].priceUsd) || null;
  } catch (error) {
    console.error('Error fetching price:', error);
    return null;
  }
}

/**
 * Get prices for multiple tokens
 */
export async function getPrices(tokenAddresses: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  
  // DexScreener doesn't have batch endpoint, fetch individually with delay
  for (const address of tokenAddresses) {
    try {
      const price = await getPrice(address);
      if (price !== null) {
        prices[address] = price;
      }
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      continue;
    }
  }
  
  return prices;
}

/**
 * Get token info
 */
export async function getTokenInfo(tokenAddress: string): Promise<Token | null> {
  // Check known tokens first
  for (const token of Object.values(KNOWN_TOKENS)) {
    if (token.address === tokenAddress) {
      return token;
    }
  }

  try {
    const response = await fetch(`${DEXSCREENER_API}/dex/tokens/${tokenAddress}`);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const solanaPairs = data.pairs?.filter((p: any) => p.chainId === 'solana') || [];
    
    if (solanaPairs.length === 0) {
      return null;
    }

    const pair = solanaPairs[0];
    return {
      symbol: pair.baseToken.symbol,
      name: pair.baseToken.name,
      address: pair.baseToken.address,
      decimals: 9, // Default
    };
  } catch (error) {
    console.error('Error fetching token info:', error);
    return null;
  }
}

/**
 * Get all tradeable tokens - returns known tokens
 */
export async function getAllTokens(): Promise<Token[]> {
  return Object.values(KNOWN_TOKENS);
}
