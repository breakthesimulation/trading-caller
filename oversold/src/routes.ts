// RSI API Routes for Trading Caller

import { Hono } from 'hono';
import {
  scanAllTokensRSI,
  getOversoldTokens,
  getOverboughtTokens,
  getTokenRSI,
  calculateRSISignalStrength,
  getCacheStatus,
  clearRSICache,
} from './scanner.js';
import type { RSIThresholds } from './types.js';

const rsiRoutes = new Hono();

// GET /rsi/status - Get scanner status and cache info
rsiRoutes.get('/rsi/status', (c) => {
  const cache = getCacheStatus();
  
  return c.json({
    success: true,
    status: 'operational',
    dataSource: 'internal',
    externalApiNote: 'oversold.lol blocked by Vercel bot protection - using internal RSI calculation',
    cache: {
      entries: cache.entries,
      tokens: cache.tokens,
    },
    defaultThresholds: {
      oversold: 30,
      overbought: 70,
      extremeOversold: 20,
      extremeOverbought: 80,
    },
    endpoints: {
      oversold: '/rsi/oversold',
      overbought: '/rsi/overbought',
      scan: '/rsi/scan',
      token: '/rsi/:symbol',
    },
  });
});

// GET /rsi/oversold - Get currently oversold tokens
rsiRoutes.get('/rsi/oversold', async (c) => {
  try {
    const threshold = parseInt(c.req.query('threshold') || '30');
    const timeframe = (c.req.query('timeframe') || '4H') as '1H' | '4H' | '1D';
    
    const oversold = await getOversoldTokens(timeframe, threshold);
    
    return c.json({
      success: true,
      count: oversold.length,
      threshold,
      timeframe,
      tokens: oversold.map(t => ({
        symbol: t.symbol,
        name: t.name,
        rsi: t.rsi,
        price: t.price,
        priceChange24h: t.priceChange24h,
        signal: calculateRSISignalStrength(t),
        lastUpdated: t.lastUpdated,
      })),
      scanTime: new Date().toISOString(),
      interpretation: oversold.length > 0
        ? `${oversold.length} token(s) showing oversold RSI - potential LONG opportunities`
        : 'No tokens currently oversold',
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scan oversold tokens',
    }, 500);
  }
});

// GET /rsi/overbought - Get currently overbought tokens
rsiRoutes.get('/rsi/overbought', async (c) => {
  try {
    const threshold = parseInt(c.req.query('threshold') || '70');
    const timeframe = (c.req.query('timeframe') || '4H') as '1H' | '4H' | '1D';
    
    const overbought = await getOverboughtTokens(timeframe, threshold);
    
    return c.json({
      success: true,
      count: overbought.length,
      threshold,
      timeframe,
      tokens: overbought.map(t => ({
        symbol: t.symbol,
        name: t.name,
        rsi: t.rsi,
        price: t.price,
        priceChange24h: t.priceChange24h,
        signal: calculateRSISignalStrength(t),
        lastUpdated: t.lastUpdated,
      })),
      scanTime: new Date().toISOString(),
      interpretation: overbought.length > 0
        ? `${overbought.length} token(s) showing overbought RSI - potential SHORT opportunities or profit-taking zones`
        : 'No tokens currently overbought',
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scan overbought tokens',
    }, 500);
  }
});

// GET /rsi/scan - Full RSI scan of all tokens
rsiRoutes.get('/rsi/scan', async (c) => {
  try {
    const timeframe = (c.req.query('timeframe') || '4H') as '1H' | '4H' | '1D';
    const oversoldThreshold = parseInt(c.req.query('oversold') || '30');
    const overboughtThreshold = parseInt(c.req.query('overbought') || '70');
    
    const thresholds: RSIThresholds = {
      oversold: oversoldThreshold,
      overbought: overboughtThreshold,
      extremeOversold: 20,
      extremeOverbought: 80,
    };
    
    const result = await scanAllTokensRSI(timeframe, thresholds);
    
    return c.json({
      success: true,
      timeframe,
      thresholds,
      tokensScanned: result.tokensScanned,
      summary: {
        oversold: result.oversold.length,
        overbought: result.overbought.length,
        neutral: result.neutral.length,
      },
      oversold: result.oversold.map(t => ({
        symbol: t.symbol,
        rsi: t.rsi,
        price: t.price,
        priceChange24h: t.priceChange24h,
        strength: calculateRSISignalStrength(t)?.strength || 'WEAK',
      })),
      overbought: result.overbought.map(t => ({
        symbol: t.symbol,
        rsi: t.rsi,
        price: t.price,
        priceChange24h: t.priceChange24h,
        strength: calculateRSISignalStrength(t)?.strength || 'WEAK',
      })),
      scanTime: result.scanTime,
      source: result.source,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to perform RSI scan',
    }, 500);
  }
});

// GET /rsi/:symbol - Get RSI for a specific token
rsiRoutes.get('/rsi/:symbol', async (c) => {
  try {
    const symbol = c.req.param('symbol').toUpperCase();
    const timeframe = (c.req.query('timeframe') || '4H') as '1H' | '4H' | '1D';
    
    const reading = await getTokenRSI(symbol, timeframe);
    
    if (!reading) {
      return c.json({
        success: false,
        error: `Token ${symbol} not found or no data available`,
      }, 404);
    }
    
    const signalStrength = calculateRSISignalStrength(reading);
    
    return c.json({
      success: true,
      symbol: reading.symbol,
      name: reading.name,
      rsi: reading.rsi,
      signal: reading.signal,
      price: reading.price,
      priceChange24h: reading.priceChange24h,
      volume24h: reading.volume24h,
      timeframe,
      signalStrength,
      interpretation: getInterpretation(reading.rsi),
      lastUpdated: reading.lastUpdated,
      source: reading.source,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch RSI',
    }, 500);
  }
});

// POST /rsi/cache/clear - Clear the RSI cache
rsiRoutes.post('/rsi/cache/clear', (c) => {
  clearRSICache();
  return c.json({
    success: true,
    message: 'RSI cache cleared',
  });
});

// Helper function to interpret RSI values
function getInterpretation(rsi: number): string {
  if (rsi <= 20) {
    return '🟢 EXTREME OVERSOLD - High probability bounce zone. Strong LONG signal.';
  }
  if (rsi <= 30) {
    return '🟢 OVERSOLD - Potential reversal zone. Consider LONG entries.';
  }
  if (rsi <= 40) {
    return '📊 Bearish bias but approaching oversold. Watch for bounce.';
  }
  if (rsi <= 60) {
    return '➖ NEUTRAL - No clear RSI signal. Wait for better setup.';
  }
  if (rsi <= 70) {
    return '📊 Bullish bias but approaching overbought. Consider profit-taking.';
  }
  if (rsi <= 80) {
    return '🔴 OVERBOUGHT - Potential reversal zone. Consider SHORT entries or profit-taking.';
  }
  return '🔴 EXTREME OVERBOUGHT - High probability pullback zone. Strong SHORT signal.';
}

export default rsiRoutes;
