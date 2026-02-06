// Oversold.lol API client (STUB)
//
// NOTE: As of 2024, oversold.lol has Vercel bot protection that blocks
// programmatic access. This file is a stub for future integration if/when:
// 1. They release a public API
// 2. We get API access
// 3. An alternative method becomes available
//
// For now, we use our internal RSI calculation via the scanner module.

import type { OversoldLolResponse, RSIReading } from './types.js';

const BASE_URL = 'https://oversold.lol';

// Token symbol mapping from our symbols to oversold.lol format
const SYMBOL_MAP: Record<string, string> = {
  'SOL': 'SOL-USD',
  'BTC': 'BTC-USD',
  'ETH': 'ETH-USD',
  'JUP': 'JUP-USD',
  'BONK': 'BONK-USD',
  'WIF': 'WIF-USD',
  // Add more mappings as needed
};

/**
 * STUB: Fetch RSI data from oversold.lol
 * 
 * This function is not operational due to bot protection.
 * See scanner.ts for the working internal implementation.
 */
export async function fetchFromOversoldLol(
  symbol: string,
  rsiThreshold: number = 25
): Promise<OversoldLolResponse | null> {
  const mappedSymbol = SYMBOL_MAP[symbol.toUpperCase()];
  
  if (!mappedSymbol) {
    console.warn(`[OversoldLol] No mapping for symbol: ${symbol}`);
    return null;
  }

  const url = `${BASE_URL}/crypto/${mappedSymbol}?rsi=${rsiThreshold}&tab=oversold`;
  
  console.warn(`[OversoldLol] API access blocked by bot protection. URL would be: ${url}`);
  console.warn('[OversoldLol] Using internal RSI calculation instead.');
  
  // Return null to indicate unavailability
  return null;
}

/**
 * STUB: Fetch oversold tokens from oversold.lol
 * 
 * Not operational - use scanner.getOversoldTokens() instead
 */
export async function getOversoldFromLol(
  rsiThreshold: number = 25
): Promise<RSIReading[]> {
  console.warn('[OversoldLol] API not available. Use scanner.getOversoldTokens() instead.');
  return [];
}

/**
 * STUB: Fetch overbought tokens from oversold.lol
 * 
 * Not operational - use scanner.getOverboughtTokens() instead
 */
export async function getOverboughtFromLol(
  rsiThreshold: number = 75
): Promise<RSIReading[]> {
  console.warn('[OversoldLol] API not available. Use scanner.getOverboughtTokens() instead.');
  return [];
}

/**
 * Check if oversold.lol API is accessible
 * 
 * Can be used to periodically check if the API becomes available
 */
export async function checkApiAvailability(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(BASE_URL, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TradingCaller/1.0)',
      },
    });
    
    clearTimeout(timeout);
    
    // If we get a 200, the site is accessible (but may still have bot protection)
    // Check for Vercel security checkpoint
    if (response.status === 200) {
      const text = await response.text();
      if (text.includes('Vercel Security Checkpoint')) {
        console.log('[OversoldLol] Site accessible but blocked by Vercel protection');
        return false;
      }
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[OversoldLol] API check failed:', error);
    return false;
  }
}
