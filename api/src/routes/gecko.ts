// GeckoTerminal API Routes — Live Solana pool data powered by GeckoTerminal

import { Hono } from 'hono';
import {
  getPoolsForToken,
  getOHLCV,
  getMultiTimeframeOHLCV,
  getTrendingPools,
  searchPools,
  getTokenInfo,
} from '../../../research-engine/src/data/geckoterminal.js';

export function createGeckoRoutes() {
  const routes = new Hono();

  // GET /gecko/pools/:tokenAddress — pools for a Solana token
  routes.get('/gecko/pools/:tokenAddress', async (c) => {
    const tokenAddress = c.req.param('tokenAddress');

    try {
      const pools = await getPoolsForToken(tokenAddress);

      return c.json({
        success: true,
        token: tokenAddress,
        count: pools.length,
        pools,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to fetch pools',
        },
        500,
      );
    }
  });

  // GET /gecko/ohlcv/:poolAddress — OHLCV candle data for a pool
  routes.get('/gecko/ohlcv/:poolAddress', async (c) => {
    const poolAddress = c.req.param('poolAddress');
    const timeframe = (c.req.query('timeframe') || 'hour') as
      | 'day'
      | 'hour'
      | 'minute';
    const aggregate = parseInt(c.req.query('aggregate') || '1', 10);
    const limit = Math.min(
      parseInt(c.req.query('limit') || '100', 10),
      1000,
    );

    try {
      const candles = await getOHLCV(poolAddress, timeframe, aggregate, limit);

      return c.json({
        success: true,
        pool: poolAddress,
        timeframe,
        aggregate,
        count: candles.length,
        candles,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to fetch OHLCV',
        },
        500,
      );
    }
  });

  // GET /gecko/ohlcv-multi/:poolAddress — Multi-timeframe OHLCV (1H, 4H, 1D)
  routes.get('/gecko/ohlcv-multi/:poolAddress', async (c) => {
    const poolAddress = c.req.param('poolAddress');

    try {
      const data = await getMultiTimeframeOHLCV(poolAddress);

      return c.json({
        success: true,
        pool: poolAddress,
        timeframes: {
          '1H': { count: data['1H'].length },
          '4H': { count: data['4H'].length },
          '1D': { count: data['1D'].length },
        },
        ohlcv: data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to fetch multi-timeframe OHLCV',
        },
        500,
      );
    }
  });

  // GET /gecko/trending — trending Solana pools
  routes.get('/gecko/trending', async (c) => {
    const page = parseInt(c.req.query('page') || '1', 10);

    try {
      const pools = await getTrendingPools(page);

      return c.json({
        success: true,
        page,
        count: pools.length,
        pools,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to fetch trending pools',
        },
        500,
      );
    }
  });

  // GET /gecko/search — search Solana pools
  routes.get('/gecko/search', async (c) => {
    const query = c.req.query('q');

    if (!query) {
      return c.json(
        { success: false, error: 'Query parameter "q" is required' },
        400,
      );
    }

    try {
      const pools = await searchPools(query);

      return c.json({
        success: true,
        query,
        count: pools.length,
        pools,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to search pools',
        },
        500,
      );
    }
  });

  // GET /gecko/token/:tokenAddress — token info from GeckoTerminal
  routes.get('/gecko/token/:tokenAddress', async (c) => {
    const tokenAddress = c.req.param('tokenAddress');

    try {
      const info = await getTokenInfo(tokenAddress);

      if (!info) {
        return c.json(
          { success: false, error: `Token not found: ${tokenAddress}` },
          404,
        );
      }

      return c.json({
        success: true,
        token: info,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to fetch token info',
        },
        500,
      );
    }
  });

  return routes;
}
