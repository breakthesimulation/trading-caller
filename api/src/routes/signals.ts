import { Hono } from 'hono';
import { TradingCallerEngine, KNOWN_TOKENS } from '../../../research-engine/src/index.js';
import type { AnalystCall, AnalystStats } from '../../../research-engine/src/signals/types.js';
import {
  saveSubscriber,
  removeSubscriber,
  loadSubscribers,
} from '../webhook-dispatch.js';

// These will be passed in via factory function
export function createSignalRoutes(engine: TradingCallerEngine) {
  const routes = new Hono();

  // In-memory storage
  const calls: AnalystCall[] = [];
  const analysts: Map<string, AnalystStats> = new Map();

  // Get latest signals
  routes.get('/signals/latest', (c) => {
    const limit = parseInt(c.req.query('limit') || '10');
    const action = c.req.query('action');

    let signals = engine.getLatestSignals(50);

    if (action) {
      signals = signals.filter(s => s.action === action.toUpperCase());
    }

    return c.json({
      success: true,
      count: Math.min(signals.length, limit),
      signals: signals.slice(0, limit),
      lastUpdate: engine.status().lastUpdate,
    });
  });

  // Get signal history
  routes.get('/signals/history', (c) => {
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const allSignals = engine.getSignals();
    const paginatedSignals = allSignals.slice(offset, offset + limit);

    return c.json({
      success: true,
      total: allSignals.length,
      offset,
      limit,
      signals: paginatedSignals,
    });
  });

  // Get analysis for a specific token
  routes.get('/tokens/:symbol/analysis', async (c) => {
    const symbol = c.req.param('symbol').toUpperCase();

    const token = Object.values(KNOWN_TOKENS).find(t => t.symbol === symbol);

    if (!token) {
      return c.json({
        success: false,
        error: 'Token not found. Try SOL, JUP, RAY, BONK, or WIF.'
      }, 404);
    }

    const result = await engine.analyzeToken(token.address);

    if (!result.analysis) {
      return c.json({
        success: false,
        error: 'Could not fetch data for this token'
      }, 500);
    }

    return c.json({
      success: true,
      token: result.token,
      analysis: result.analysis.analysis,
      summary: result.analysis.summary,
      signal: result.signal,
    });
  });

  // Get leaderboard
  routes.get('/leaderboard', (c) => {
    const limit = parseInt(c.req.query('limit') || '20');

    const sorted = Array.from(analysts.values())
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, limit);

    return c.json({
      success: true,
      leaderboard: sorted,
      totalAnalysts: analysts.size,
    });
  });

  // Submit a trading call
  routes.post('/calls', async (c) => {
    try {
      const body = await c.req.json();

      const { analystId, token, direction, entry, target, stopLoss, timeframe } = body;

      if (!analystId || !token || !direction || !entry || !target || !stopLoss) {
        return c.json({
          success: false,
          error: 'Missing required fields: analystId, token, direction, entry, target, stopLoss'
        }, 400);
      }

      const call: AnalystCall = {
        id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        analystId,
        token,
        direction: direction.toUpperCase(),
        entry,
        target,
        stopLoss,
        timeframe: timeframe || '24h',
        submittedAt: new Date().toISOString(),
      };

      calls.push(call);

      if (!analysts.has(analystId)) {
        analysts.set(analystId, {
          analystId,
          name: analystId,
          totalCalls: 0,
          wins: 0,
          losses: 0,
          neutral: 0,
          winRate: 0,
          avgReturn: 0,
          profitFactor: 0,
          rank: 0,
          lastActive: new Date().toISOString(),
        });
      }

      const stats = analysts.get(analystId)!;
      stats.totalCalls++;
      stats.lastActive = new Date().toISOString();

      return c.json({
        success: true,
        call,
      }, 201);
    } catch (error) {
      return c.json({
        success: false,
        error: 'Invalid request body'
      }, 400);
    }
  });

  // Get a specific call
  routes.get('/calls/:id', (c) => {
    const id = c.req.param('id');
    const call = calls.find(c => c.id === id);

    if (!call) {
      return c.json({ success: false, error: 'Call not found' }, 404);
    }

    return c.json({ success: true, call });
  });

  // Get analyst stats
  routes.get('/analysts/:id/stats', (c) => {
    const id = c.req.param('id');
    const stats = analysts.get(id);

    if (!stats) {
      return c.json({ success: false, error: 'Analyst not found' }, 404);
    }

    return c.json({ success: true, stats });
  });

  // -- Webhook Subscription Endpoints --

  // Kept for backward-compat: dashboard reads webhooks.size
  const webhooks: Map<string, string[]> = new Map();

  /** Sync the in-memory map from the persisted subscriber list */
  function refreshWebhooksMap(): void {
    webhooks.clear();
    for (const sub of loadSubscribers()) {
      webhooks.set(sub.url, sub.events);
    }
  }

  // Hydrate map on startup
  refreshWebhooksMap();

  routes.post('/subscribe', async (c) => {
    try {
      const body = await c.req.json();
      const { url, webhook, events } = body;

      // Accept either 'url' or legacy 'webhook' field
      const subscriberUrl = url || webhook;
      if (!subscriberUrl) {
        return c.json({
          success: false,
          error: 'Missing required field: url',
        }, 400);
      }

      const subscriber = saveSubscriber(subscriberUrl, events || ['signal']);
      refreshWebhooksMap();

      return c.json({
        success: true,
        subscriber,
      }, 201);
    } catch (error) {
      return c.json({
        success: false,
        error: 'Invalid request body',
      }, 400);
    }
  });

  routes.delete('/subscribe', async (c) => {
    try {
      const body = await c.req.json();
      const { url } = body;

      if (!url) {
        return c.json({
          success: false,
          error: 'Missing required field: url',
        }, 400);
      }

      const removed = removeSubscriber(url);
      refreshWebhooksMap();

      if (!removed) {
        return c.json({ success: false, error: 'Subscriber not found' }, 404);
      }

      return c.json({ success: true, message: 'Subscriber removed' });
    } catch (error) {
      return c.json({
        success: false,
        error: 'Invalid request body',
      }, 400);
    }
  });

  routes.get('/subscribers', (c) => {
    const subscribers = loadSubscribers();
    return c.json({
      success: true,
      count: subscribers.length,
      subscribers,
    });
  });

  return { routes, calls, analysts, webhooks };
}
