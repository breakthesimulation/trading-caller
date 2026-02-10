// Trading Caller - Multi-Timeframe RSI Scanner
// Fetches OHLCV data from CoinGecko and calculates RSI across 4 timeframes

import { Hono } from 'hono';

const app = new Hono();

// Token symbol to CoinGecko ID mapping
const COINGECKO_TOKEN_MAP: Record<string, string> = {
  SOL: 'solana',
  JUP: 'jupiter-exchange-solana',
  BONK: 'bonk',
  WIF: 'dogwifhat',
  PYTH: 'pyth-network',
  JTO: 'jito-governance-token',
  RAY: 'raydium',
  ORCA: 'orca-2',
  POPCAT: 'popcat',
  MEW: 'cat-in-a-dogs-world',
  TRUMP: 'official-trump',
  RENDER: 'render-token',
  PENGU: 'pudgy-penguins',
  FARTCOIN: 'fartcoin',
  GOAT: 'goatseus-maximus',
  MOODENG: 'moo-deng',
  CHILLGUY: 'just-a-chill-guy',
  HNT: 'helium',
  STEP: 'step-finance',
  MELANIA: 'melania-meme'
};

// Reverse mapping for getting symbol from ID
const ID_TO_SYMBOL_MAP: Record<string, string> = {};
for (const [symbol, id] of Object.entries(COINGECKO_TOKEN_MAP)) {
  ID_TO_SYMBOL_MAP[id] = symbol;
}

// Timeframe configurations for CoinGecko API
const TIMEFRAME_CONFIG = {
  '1h': { days: 1, interval: '30min', name: '1H' },    // 30min candles for 1H RSI
  '4h': { days: 14, interval: '4h', name: '4H' },      // 4H candles for 4H RSI  
  '1d': { days: 30, interval: '1d', name: '1D' },      // Daily candles for 1D RSI
  '1w': { days: 90, interval: '4d', name: '1W' }       // ~4-day candles for 1W RSI approximation
};

// Cache structure
interface CachedData {
  timestamp: number;
  data: TokenRSIData[];
}

interface TokenRSIData {
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  rsi: {
    '1h': number;
    '4h': number;
    '1d': number;
    '1w': number;
  };
  signal: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
  strength: 'extreme' | 'strong' | 'moderate' | 'neutral';
}

interface OHLCData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// In-memory cache (5 minutes)
let cachedRSIData: CachedData | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// RSI Calculation - Standard RSI-14
function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50; // not enough data
  
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i-1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i-1];
    avgGain = (avgGain * (period - 1) + Math.max(0, change)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -change)) / period;
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Fetch OHLC data from CoinGecko
async function fetchOHLCData(coinId: string, days: number): Promise<OHLCData[]> {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TradingCaller/1.0 (https://github.com/breakthesimulation/trading-caller)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }
    
    const rawData = await response.json() as [number, number, number, number, number][];
    
    return rawData.map(([timestamp, open, high, low, close]) => ({
      timestamp,
      open,
      high,
      low,
      close
    }));
  } catch (error) {
    console.error(`Failed to fetch OHLC data for ${coinId}:`, error);
    throw error;
  }
}

// Get current price and 24h change from CoinGecko simple price API
async function fetchCurrentPrice(coinId: string): Promise<{ price: number; change24h: number; name: string }> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TradingCaller/1.0 (https://github.com/breakthesimulation/trading-caller)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`CoinGecko price API error: ${response.status}`);
    }
    
    const data = await response.json() as Record<string, { usd: number; usd_24h_change: number }>;
    const tokenData = data[coinId];
    
    if (!tokenData) {
      throw new Error(`No price data found for ${coinId}`);
    }
    
    // Get token name from ID
    const symbol = ID_TO_SYMBOL_MAP[coinId] || coinId.toUpperCase();
    const name = getTokenName(symbol);
    
    return {
      price: tokenData.usd,
      change24h: tokenData.usd_24h_change || 0,
      name
    };
  } catch (error) {
    console.error(`Failed to fetch price for ${coinId}:`, error);
    throw error;
  }
}

// Get human-readable token name
function getTokenName(symbol: string): string {
  const nameMap: Record<string, string> = {
    SOL: 'Solana',
    JUP: 'Jupiter',
    BONK: 'Bonk',
    WIF: 'dogwifhat',
    PYTH: 'Pyth Network',
    JTO: 'Jito',
    RAY: 'Raydium',
    ORCA: 'Orca',
    POPCAT: 'Popcat',
    MEW: 'Cat in a Dogs World',
    TRUMP: 'Official Trump',
    RENDER: 'Render Token',
    PENGU: 'Pudgy Penguins',
    FARTCOIN: 'Fartcoin',
    GOAT: 'Goatseus Maximus',
    MOODENG: 'Moo Deng',
    CHILLGUY: 'Just a Chill Guy',
    HNT: 'Helium',
    STEP: 'Step Finance',
    MELANIA: 'Melania Meme'
  };
  
  return nameMap[symbol] || symbol;
}

// Calculate RSI for all timeframes for a token
async function calculateTokenRSI(symbol: string, coinId: string): Promise<TokenRSIData | null> {
  try {
    // Fetch price data first
    const priceData = await fetchCurrentPrice(coinId);
    
    // Calculate RSI for each timeframe
    const rsiResults: Record<string, number> = {};
    
    for (const [timeframe, config] of Object.entries(TIMEFRAME_CONFIG)) {
      try {
        const ohlcData = await fetchOHLCData(coinId, config.days);
        
        if (ohlcData.length < 15) {
          console.warn(`Insufficient data for ${symbol} ${timeframe}: ${ohlcData.length} candles`);
          rsiResults[timeframe] = 50; // Default neutral RSI
          continue;
        }
        
        const closes = ohlcData.map(d => d.close);
        const rsi = calculateRSI(closes, 14);
        rsiResults[timeframe] = Math.round(rsi * 10) / 10; // Round to 1 decimal
        
        // Add delay between API calls to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Failed to calculate RSI for ${symbol} ${timeframe}:`, error);
        rsiResults[timeframe] = 50; // Default neutral RSI
      }
    }
    
    // Determine overall signal based on the most oversold/overbought timeframe
    const rsiValues = Object.values(rsiResults);
    const minRSI = Math.min(...rsiValues);
    const maxRSI = Math.max(...rsiValues);
    
    let signal: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
    let strength: 'extreme' | 'strong' | 'moderate' | 'neutral';
    
    if (minRSI <= 20) {
      signal = 'OVERSOLD';
      strength = 'extreme';
    } else if (minRSI <= 30) {
      signal = 'OVERSOLD';
      strength = 'strong';
    } else if (minRSI <= 40) {
      signal = 'OVERSOLD';
      strength = 'moderate';
    } else if (maxRSI >= 80) {
      signal = 'OVERBOUGHT';
      strength = 'extreme';
    } else if (maxRSI >= 70) {
      signal = 'OVERBOUGHT';
      strength = 'strong';
    } else if (maxRSI >= 60) {
      signal = 'OVERBOUGHT';
      strength = 'moderate';
    } else {
      signal = 'NEUTRAL';
      strength = 'neutral';
    }
    
    return {
      symbol,
      name: priceData.name,
      price: Math.round(priceData.price * 1000) / 1000, // Round to 3 decimals
      priceChange24h: Math.round(priceData.change24h * 100) / 100, // Round to 2 decimals
      rsi: {
        '1h': rsiResults['1h'],
        '4h': rsiResults['4h'],
        '1d': rsiResults['1d'],
        '1w': rsiResults['1w']
      },
      signal,
      strength
    };
  } catch (error) {
    console.error(`Failed to calculate token RSI for ${symbol}:`, error);
    return null;
  }
}

// Scan all tokens and calculate RSI data
async function scanAllTokens(): Promise<TokenRSIData[]> {
  console.log('[RSI Multi] Starting comprehensive RSI scan for all tokens...');
  const results: TokenRSIData[] = [];
  const tokens = Object.entries(COINGECKO_TOKEN_MAP);
  
  let processed = 0;
  for (const [symbol, coinId] of tokens) {
    try {
      console.log(`[RSI Multi] Processing ${symbol} (${processed + 1}/${tokens.length})...`);
      const tokenRSI = await calculateTokenRSI(symbol, coinId);
      
      if (tokenRSI) {
        results.push(tokenRSI);
        console.log(`[RSI Multi] ${symbol}: 1H=${tokenRSI.rsi['1h']}, 4H=${tokenRSI.rsi['4h']}, 1D=${tokenRSI.rsi['1d']}, 1W=${tokenRSI.rsi['1w']} (${tokenRSI.signal})`);
      }
      
      processed++;
      
      // Add delay between tokens to respect rate limits (2s per timeframe + 1s buffer = ~9s per token)
      if (processed < tokens.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`[RSI Multi] Failed to process ${symbol}:`, error);
      processed++;
    }
  }
  
  console.log(`[RSI Multi] Scan complete: ${results.length}/${tokens.length} tokens processed`);
  
  // Sort results by signal strength and RSI extremes
  results.sort((a, b) => {
    // Priority order: extreme -> strong -> moderate -> neutral
    const strengthOrder = { extreme: 0, strong: 1, moderate: 2, neutral: 3 };
    const aOrder = strengthOrder[a.strength];
    const bOrder = strengthOrder[b.strength];
    
    if (aOrder !== bOrder) return aOrder - bOrder;
    
    // Within same strength, sort by most extreme RSI
    const aMinRSI = Math.min(Object.values(a.rsi) as number[]);
    const bMinRSI = Math.min(Object.values(b.rsi) as number[]);
    const aMaxRSI = Math.max(Object.values(a.rsi) as number[]);
    const bMaxRSI = Math.max(Object.values(b.rsi) as number[]);
    
    if (a.signal === 'OVERSOLD' && b.signal === 'OVERSOLD') {
      return aMinRSI - bMinRSI; // Lower RSI first for oversold
    } else if (a.signal === 'OVERBOUGHT' && b.signal === 'OVERBOUGHT') {
      return bMaxRSI - aMaxRSI; // Higher RSI first for overbought
    } else if (a.signal === 'OVERSOLD') {
      return -1; // Oversold signals first
    } else if (b.signal === 'OVERSOLD') {
      return 1;
    }
    
    return 0; // Keep original order
  });
  
  return results;
}

// Check if cache is valid
function isCacheValid(): boolean {
  if (!cachedRSIData) return false;
  return Date.now() - cachedRSIData.timestamp < CACHE_DURATION;
}

// Get cached data or perform new scan
async function getRSIData(): Promise<TokenRSIData[]> {
  if (isCacheValid() && cachedRSIData) {
    console.log('[RSI Multi] Returning cached data');
    return cachedRSIData.data;
  }
  
  console.log('[RSI Multi] Cache expired or empty, performing new scan...');
  const freshData = await scanAllTokens();
  
  // Update cache
  cachedRSIData = {
    timestamp: Date.now(),
    data: freshData
  };
  
  return freshData;
}

// Route: GET /rsi/multi - Multi-timeframe RSI scanner
app.get('/rsi/multi', async (c) => {
  try {
    const tokenData = await getRSIData();
    
    return c.json({
      success: true,
      lastUpdated: cachedRSIData?.timestamp ? new Date(cachedRSIData.timestamp).toISOString() : new Date().toISOString(),
      count: tokenData.length,
      tokens: tokenData,
      cacheStatus: isCacheValid() ? 'cached' : 'fresh',
      nextUpdate: cachedRSIData ? new Date(cachedRSIData.timestamp + CACHE_DURATION).toISOString() : null,
      api: {
        source: 'CoinGecko Free API',
        timeframes: ['1H', '4H', '1D', '1W'],
        rsiPeriod: 14,
        cacheDuration: `${CACHE_DURATION / 1000 / 60} minutes`
      }
    });
  } catch (error) {
    console.error('[RSI Multi] Endpoint error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      lastUpdated: cachedRSIData?.timestamp ? new Date(cachedRSIData.timestamp).toISOString() : null
    }, 500);
  }
});

// Route: GET /rsi/multi/token/:symbol - Get RSI data for specific token
app.get('/rsi/multi/token/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  
  if (!COINGECKO_TOKEN_MAP[symbol]) {
    return c.json({
      success: false,
      error: `Token ${symbol} not found. Supported tokens: ${Object.keys(COINGECKO_TOKEN_MAP).join(', ')}`
    }, 404);
  }
  
  try {
    const coinId = COINGECKO_TOKEN_MAP[symbol];
    const tokenRSI = await calculateTokenRSI(symbol, coinId);
    
    if (!tokenRSI) {
      return c.json({
        success: false,
        error: `Failed to calculate RSI for ${symbol}`
      }, 500);
    }
    
    return c.json({
      success: true,
      token: tokenRSI,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[RSI Multi] Token ${symbol} error:`, error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, 500);
  }
});

// Route: POST /rsi/multi/scan - Force a new scan (bypass cache)
app.post('/rsi/multi/scan', async (c) => {
  try {
    console.log('[RSI Multi] Forced scan triggered via API');
    const freshData = await scanAllTokens();
    
    // Update cache with fresh data
    cachedRSIData = {
      timestamp: Date.now(),
      data: freshData
    };
    
    return c.json({
      success: true,
      message: 'Fresh RSI scan completed',
      scannedAt: new Date().toISOString(),
      count: freshData.length,
      tokens: freshData
    });
  } catch (error) {
    console.error('[RSI Multi] Forced scan error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Scan failed'
    }, 500);
  }
});

// Route: GET /rsi/multi/status - Get scanner status and cache info
app.get('/rsi/multi/status', (c) => {
  return c.json({
    success: true,
    status: 'operational',
    cache: {
      hasData: !!cachedRSIData,
      lastUpdated: cachedRSIData?.timestamp ? new Date(cachedRSIData.timestamp).toISOString() : null,
      isValid: isCacheValid(),
      nextRefresh: cachedRSIData ? new Date(cachedRSIData.timestamp + CACHE_DURATION).toISOString() : null,
      cacheDurationMinutes: CACHE_DURATION / 1000 / 60
    },
    tokens: {
      tracked: Object.keys(COINGECKO_TOKEN_MAP).length,
      list: Object.keys(COINGECKO_TOKEN_MAP)
    },
    timeframes: Object.keys(TIMEFRAME_CONFIG)
  });
});

// Start background scanner (runs every 5 minutes)
function startBackgroundScanner() {
  console.log('[RSI Multi] Starting background scanner (every 5 minutes)...');
  
  // Initial scan after 30 seconds
  setTimeout(async () => {
    try {
      console.log('[RSI Multi] Performing initial background scan...');
      await getRSIData();
    } catch (error) {
      console.error('[RSI Multi] Initial scan failed:', error);
    }
  }, 30000);
  
  // Then every 5 minutes
  setInterval(async () => {
    try {
      if (!isCacheValid()) {
        console.log('[RSI Multi] Background scan triggered...');
        await getRSIData();
      }
    } catch (error) {
      console.error('[RSI Multi] Background scan failed:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes
}

// Start the background scanner
startBackgroundScanner();

export const rsiMultiRoutes = app;
export { getRSIData, calculateTokenRSI };