// Trading Caller - Top 100 Solana RSI Scanner
// Progressive scanning with smart rate limiting and dynamic token discovery

import { Hono } from 'hono';

const app = new Hono();

// Cache interfaces
interface TokenBasicData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  total_volume: number;
  market_cap: number;
}

interface RSIData {
  '1h': number | null;
  '4h': number | null;
  '1d': number | null;
  '1w': number | null;
}

interface TokenRSIData {
  symbol: string;
  name: string;
  id: string;
  image: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  rsi: RSIData;
  signal: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
  strength: 'extreme' | 'strong' | 'moderate' | 'neutral';
  lastUpdated?: string;
}

interface CachedTokenList {
  timestamp: number;
  tokens: TokenBasicData[];
}

interface CachedRSIData {
  tokenId: string;
  timestamp: number;
  rsi: RSIData;
}

interface ScanProgress {
  total: number;
  withRSI: number;
  scanning: boolean;
  currentBatch: number;
  totalBatches: number;
  scannedTokens: string[];
}

// Cache storage
let tokenListCache: CachedTokenList | null = null;
let rsiCache: Map<string, CachedRSIData> = new Map();
let scanProgress: ScanProgress = {
  total: 0,
  withRSI: 0,
  scanning: false,
  currentBatch: 0,
  totalBatches: 0,
  scannedTokens: []
};

// Cache durations
const TOKEN_LIST_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const RSI_CACHE_DURATION = 120 * 60 * 1000; // 2 hours (CoinGecko free tier rate limits are harsh)
const RATE_LIMIT_DELAY = 3000; // 3 seconds between API calls
const BATCH_DELAY = 10000; // 10 seconds between batches
const BATCH_SIZE = 5; // 5 tokens per batch

// Background scanning state
let backgroundScanInterval: NodeJS.Timeout | null = null;
let currentScanTimeout: NodeJS.Timeout | null = null;

// Utility functions
function isTokenListCacheValid(): boolean {
  if (!tokenListCache) return false;
  return Date.now() - tokenListCache.timestamp < TOKEN_LIST_CACHE_DURATION;
}

function isRSICacheValid(tokenId: string): boolean {
  const cached = rsiCache.get(tokenId);
  if (!cached) return false;
  return Date.now() - cached.timestamp < RSI_CACHE_DURATION;
}

function getSignalFromRSI(rsiValues: RSIData): { signal: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL'; strength: 'extreme' | 'strong' | 'moderate' | 'neutral' } {
  const validValues = Object.values(rsiValues).filter(v => v !== null) as number[];
  if (validValues.length === 0) return { signal: 'NEUTRAL', strength: 'neutral' };
  
  const minRSI = Math.min(...validValues);
  const maxRSI = Math.max(...validValues);
  
  if (minRSI <= 20) return { signal: 'OVERSOLD', strength: 'extreme' };
  if (minRSI <= 30) return { signal: 'OVERSOLD', strength: 'strong' };
  if (minRSI <= 40) return { signal: 'OVERSOLD', strength: 'moderate' };
  if (maxRSI >= 80) return { signal: 'OVERBOUGHT', strength: 'extreme' };
  if (maxRSI >= 70) return { signal: 'OVERBOUGHT', strength: 'strong' };
  if (maxRSI >= 60) return { signal: 'OVERBOUGHT', strength: 'moderate' };
  
  return { signal: 'NEUTRAL', strength: 'neutral' };
}

// Fetch top 100 Solana tokens from CoinGecko
async function fetchSolanaTokens(): Promise<TokenBasicData[]> {
  console.log('[RSI Multi] Fetching top 100 Solana tokens...');
  
  try {
    const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=solana-ecosystem&order=volume_desc&per_page=100&page=1&sparkline=false';
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TradingCaller/2.0'
      }
    });
    
    if (!response.ok) {
      if (response.status === 429) {
        console.warn('[RSI Multi] Rate limited on token list fetch, using cache or defaults');
        throw new Error('Rate limited');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const tokens = await response.json() as TokenBasicData[];
    
    // Filter out stablecoins and wrapped tokens
    const filtered = tokens.filter(token => {
      const symbol = token.symbol.toLowerCase();
      const name = token.name.toLowerCase();
      return !symbol.includes('usd') && 
             !symbol.includes('usdc') && 
             !symbol.includes('usdt') && 
             !symbol.includes('dai') &&
             !symbol.includes('wrapped') &&
             !name.includes('wrapped') &&
             !name.includes('bridged') &&
             token.market_cap > 1000000; // Min $1M market cap
    });
    
    console.log(`[RSI Multi] Found ${filtered.length} valid Solana tokens`);
    return filtered.slice(0, 100); // Ensure max 100
  } catch (error) {
    console.error('[RSI Multi] Failed to fetch Solana tokens:', error);
    throw error;
  }
}

// Calculate RSI from price array
function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;
  
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

// Group 30-min candles into 1-hour candles
function groupIntoHourly(candles: number[][]): number[][] {
  const grouped: number[][] = [];
  for (let i = 0; i < candles.length - 1; i += 2) {
    if (i + 1 < candles.length) {
      const open = candles[i][1];
      const high = Math.max(candles[i][2], candles[i+1][2]);
      const low = Math.min(candles[i][3], candles[i+1][3]);
      const close = candles[i+1][4];
      grouped.push([candles[i][0], open, high, low, close]);
    }
  }
  return grouped;
}

// Fetch OHLC data for a specific timeframe
async function fetchOHLC(tokenId: string, days: number): Promise<number[][]> {
  const url = `https://api.coingecko.com/api/v3/coins/${tokenId}/ohlc?vs_currency=usd&days=${days}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TradingCaller/2.0'
      }
    });
    
    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`[RSI Multi] Rate limited for ${tokenId}, backing off...`);
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10s backoff
        throw new Error('Rate limited');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json() as number[][];
    return data;
  } catch (error) {
    console.error(`[RSI Multi] OHLC fetch failed for ${tokenId}:`, error);
    throw error;
  }
}

// Calculate all RSI timeframes for a token
async function calculateTokenRSI(tokenId: string): Promise<RSIData> {
  const rsi: RSIData = { '1h': null, '4h': null, '1d': null, '1w': null };
  
  console.log(`[RSI Multi] Calculating RSI for ${tokenId}...`);
  
  try {
    // 1H RSI from 30-min candles (days=1)
    try {
      const data1h = await fetchOHLC(tokenId, 1);
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      
      if (data1h.length >= 30) { // Need enough 30min candles
        const hourlyCandles = groupIntoHourly(data1h);
        if (hourlyCandles.length >= 15) {
          const closes = hourlyCandles.map(c => c[4]);
          rsi['1h'] = Math.round(calculateRSI(closes) * 10) / 10;
        }
      }
    } catch (error) {
      console.warn(`[RSI Multi] 1H RSI failed for ${tokenId}:`, error);
    }
    
    // 4H RSI (days=14)
    try {
      const data4h = await fetchOHLC(tokenId, 14);
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      
      if (data4h.length >= 15) {
        const closes = data4h.map(c => c[4]);
        rsi['4h'] = Math.round(calculateRSI(closes) * 10) / 10;
      }
    } catch (error) {
      console.warn(`[RSI Multi] 4H RSI failed for ${tokenId}:`, error);
    }
    
    // 1D RSI (days=30)
    try {
      const data1d = await fetchOHLC(tokenId, 30);
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      
      if (data1d.length >= 15) {
        const closes = data1d.map(c => c[4]);
        rsi['1d'] = Math.round(calculateRSI(closes) * 10) / 10;
      }
    } catch (error) {
      console.warn(`[RSI Multi] 1D RSI failed for ${tokenId}:`, error);
    }
    
    // 1W RSI (days=90, ~4-day candles)
    try {
      const data1w = await fetchOHLC(tokenId, 90);
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      
      if (data1w.length >= 15) {
        const closes = data1w.map(c => c[4]);
        rsi['1w'] = Math.round(calculateRSI(closes) * 10) / 10;
      }
    } catch (error) {
      console.warn(`[RSI Multi] 1W RSI failed for ${tokenId}:`, error);
    }
    
  } catch (error) {
    console.error(`[RSI Multi] Token RSI calculation failed for ${tokenId}:`, error);
  }
  
  // Cache the result
  rsiCache.set(tokenId, {
    tokenId,
    timestamp: Date.now(),
    rsi
  });
  
  return rsi;
}

// Get token list (cached or fresh)
async function getTokenList(): Promise<TokenBasicData[]> {
  if (isTokenListCacheValid() && tokenListCache) {
    console.log('[RSI Multi] Using cached token list');
    return tokenListCache.tokens;
  }
  
  console.log('[RSI Multi] Fetching fresh token list...');
  try {
    const tokens = await fetchSolanaTokens();
    tokenListCache = {
      timestamp: Date.now(),
      tokens
    };
    return tokens;
  } catch (error) {
    console.error('[RSI Multi] Failed to fetch token list:', error);
    // Return cached data if available, even if expired
    if (tokenListCache) {
      console.log('[RSI Multi] Using expired cache due to fetch failure');
      return tokenListCache.tokens;
    }
    throw error;
  }
}

// Background progressive scanning
async function startProgressiveScan() {
  if (scanProgress.scanning) {
    console.log('[RSI Multi] Scan already in progress, skipping');
    return;
  }
  
  try {
    const tokens = await getTokenList();
    const tokensNeedingRSI = tokens.filter(token => !isRSICacheValid(token.id));
    
    if (tokensNeedingRSI.length === 0) {
      console.log('[RSI Multi] All tokens have valid RSI cache');
      return;
    }
    
    scanProgress = {
      total: tokens.length,
      withRSI: tokens.length - tokensNeedingRSI.length,
      scanning: true,
      currentBatch: 0,
      totalBatches: Math.ceil(tokensNeedingRSI.length / BATCH_SIZE),
      scannedTokens: []
    };
    
    console.log(`[RSI Multi] Starting progressive scan: ${tokensNeedingRSI.length} tokens need RSI update`);
    
    // Process in batches
    for (let i = 0; i < tokensNeedingRSI.length; i += BATCH_SIZE) {
      const batch = tokensNeedingRSI.slice(i, i + BATCH_SIZE);
      scanProgress.currentBatch = Math.floor(i / BATCH_SIZE) + 1;
      
      console.log(`[RSI Multi] Batch ${scanProgress.currentBatch}/${scanProgress.totalBatches}: Scanning ${batch.map(t => t.symbol).join(', ')}...`);
      
      // Process batch concurrently but respect rate limits
      for (const token of batch) {
        try {
          await calculateTokenRSI(token.id);
          scanProgress.withRSI++;
          scanProgress.scannedTokens.push(token.symbol);
          console.log(`[RSI Multi] ✓ ${token.symbol} RSI calculated`);
        } catch (error) {
          console.error(`[RSI Multi] ✗ Failed to calculate RSI for ${token.symbol}:`, error);
        }
      }
      
      // Wait before next batch (unless it's the last batch)
      if (i + BATCH_SIZE < tokensNeedingRSI.length) {
        console.log(`[RSI Multi] Waiting ${BATCH_DELAY/1000}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }
    
    console.log(`[RSI Multi] Progressive scan complete: ${scanProgress.withRSI}/${scanProgress.total} tokens have RSI data`);
  } catch (error) {
    console.error('[RSI Multi] Progressive scan failed:', error);
  } finally {
    scanProgress.scanning = false;
  }
}

// Combine token list with RSI data
function buildTokenRSIData(tokens: TokenBasicData[]): TokenRSIData[] {
  return tokens.map(token => {
    const cached = rsiCache.get(token.id);
    const rsi = cached?.rsi || { '1h': null, '4h': null, '1d': null, '1w': null };
    const { signal, strength } = getSignalFromRSI(rsi);
    
    return {
      symbol: token.symbol.toUpperCase(),
      name: token.name,
      id: token.id,
      image: token.image,
      price: Math.round(token.current_price * 1000000) / 1000000,
      priceChange24h: Math.round((token.price_change_percentage_24h || 0) * 100) / 100,
      volume24h: token.total_volume,
      marketCap: token.market_cap,
      rsi,
      signal,
      strength,
      lastUpdated: cached ? new Date(cached.timestamp).toISOString() : undefined
    };
  });
}

// API Routes

// GET /rsi/multi - Main endpoint
app.get('/rsi/multi', async (c) => {
  try {
    const tokens = await getTokenList();
    const tokenData = buildTokenRSIData(tokens);
    
    // Sort by signal strength and then by RSI extremes
    tokenData.sort((a, b) => {
      const strengthOrder = { extreme: 0, strong: 1, moderate: 2, neutral: 3 };
      const aOrder = strengthOrder[a.strength];
      const bOrder = strengthOrder[b.strength];
      
      if (aOrder !== bOrder) return aOrder - bOrder;
      
      // Within same strength, sort by volume (higher first)
      return b.volume24h - a.volume24h;
    });
    
    return c.json({
      success: true,
      lastUpdated: new Date().toISOString(),
      scanProgress,
      tokens: tokenData,
      stats: {
        total: tokens.length,
        withRSI: scanProgress.withRSI,
        scanning: scanProgress.scanning
      }
    });
  } catch (error) {
    console.error('[RSI Multi] Main endpoint error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      scanProgress,
      tokens: []
    }, 500);
  }
});

// GET /rsi/multi/status - Scanner status
app.get('/rsi/multi/status', async (c) => {
  const tokens = tokenListCache?.tokens || [];
  const validRSICount = tokens.filter(t => isRSICacheValid(t.id)).length;
  
  return c.json({
    success: true,
    status: 'operational',
    cache: {
      tokenList: {
        hasData: !!tokenListCache,
        lastUpdated: tokenListCache ? new Date(tokenListCache.timestamp).toISOString() : null,
        isValid: isTokenListCacheValid(),
        count: tokens.length
      },
      rsi: {
        totalCached: rsiCache.size,
        validCount: validRSICount,
        expiredCount: rsiCache.size - validRSICount
      }
    },
    scanProgress,
    config: {
      batchSize: BATCH_SIZE,
      rateLimitDelayMs: RATE_LIMIT_DELAY,
      rsiCacheDurationMinutes: RSI_CACHE_DURATION / 60000,
      tokenListCacheDurationMinutes: TOKEN_LIST_CACHE_DURATION / 60000
    }
  });
});

// GET /rsi/multi/token/:id - Single token detail
app.get('/rsi/multi/token/:id', async (c) => {
  const tokenId = c.req.param('id').toLowerCase();
  
  try {
    const tokens = await getTokenList();
    const token = tokens.find(t => t.id === tokenId || t.symbol.toLowerCase() === tokenId);
    
    if (!token) {
      return c.json({
        success: false,
        error: `Token not found: ${tokenId}`
      }, 404);
    }
    
    // Check if we have valid cached RSI
    let rsi = rsiCache.get(token.id)?.rsi;
    
    // If no valid cache, calculate on-demand
    if (!isRSICacheValid(token.id)) {
      console.log(`[RSI Multi] On-demand RSI calculation for ${token.symbol}`);
      rsi = await calculateTokenRSI(token.id);
    }
    
    const { signal, strength } = getSignalFromRSI(rsi || { '1h': null, '4h': null, '1d': null, '1w': null });
    
    const tokenData: TokenRSIData = {
      symbol: token.symbol.toUpperCase(),
      name: token.name,
      id: token.id,
      image: token.image,
      price: Math.round(token.current_price * 1000000) / 1000000,
      priceChange24h: Math.round((token.price_change_percentage_24h || 0) * 100) / 100,
      volume24h: token.total_volume,
      marketCap: token.market_cap,
      rsi: rsi || { '1h': null, '4h': null, '1d': null, '1w': null },
      signal,
      strength
    };
    
    return c.json({
      success: true,
      token: tokenData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[RSI Multi] Token detail error for ${tokenId}:`, error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// POST /rsi/multi/scan - Force rescan
app.post('/rsi/multi/scan', async (c) => {
  try {
    // Clear RSI cache to force fresh calculation
    rsiCache.clear();
    console.log('[RSI Multi] Forced scan triggered - cache cleared');
    
    // Start progressive scan
    setTimeout(() => startProgressiveScan(), 1000);
    
    return c.json({
      success: true,
      message: 'Forced scan initiated',
      timestamp: new Date().toISOString(),
      scanProgress: {
        ...scanProgress,
        scanning: true
      }
    });
  } catch (error) {
    console.error('[RSI Multi] Forced scan error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Scan initiation failed'
    }, 500);
  }
});

// GET /rsi/multi/search - Search tokens
app.get('/rsi/multi/search', async (c) => {
  const query = c.req.query('q')?.toLowerCase().trim();
  
  if (!query) {
    return c.json({
      success: false,
      error: 'Query parameter required'
    }, 400);
  }
  
  try {
    const tokens = await getTokenList();
    const matches = tokens.filter(token => 
      token.symbol.toLowerCase().includes(query) || 
      token.name.toLowerCase().includes(query) ||
      token.id.toLowerCase().includes(query)
    );
    
    const tokenData = buildTokenRSIData(matches);
    
    return c.json({
      success: true,
      query,
      matches: tokenData.length,
      tokens: tokenData
    });
  } catch (error) {
    console.error('[RSI Multi] Search error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Search failed'
    }, 500);
  }
});

// Background scanner initialization
function startBackgroundScanner() {
  console.log('[RSI Multi] Starting background scanner...');
  
  // Initial scan after 30 seconds
  setTimeout(() => {
    startProgressiveScan();
  }, 30000);
  
  // Then scan every 5 minutes
  backgroundScanInterval = setInterval(() => {
    if (!scanProgress.scanning) {
      startProgressiveScan();
    }
  }, 5 * 60 * 1000);
}

// Cleanup function
function stopBackgroundScanner() {
  if (backgroundScanInterval) {
    clearInterval(backgroundScanInterval);
    backgroundScanInterval = null;
  }
  if (currentScanTimeout) {
    clearTimeout(currentScanTimeout);
    currentScanTimeout = null;
  }
  console.log('[RSI Multi] Background scanner stopped');
}

// Initialize background scanning
startBackgroundScanner();

// Graceful shutdown
process.on('SIGTERM', stopBackgroundScanner);
process.on('SIGINT', stopBackgroundScanner);

export const rsiMultiRoutes = app;
export { getTokenList, calculateTokenRSI, buildTokenRSIData };