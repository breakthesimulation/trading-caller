// Volume Scanner API Routes

import { Hono } from 'hono';
import { VolumeScanner, getVolumeScanner } from './scanner.js';
import { TRACKED_TOKENS } from './tokens.js';
import { storage } from './storage.js';

const volumeRoutes = new Hono();

// Get or create scanner instance
let scanner: VolumeScanner | null = null;

async function getScanner(): Promise<VolumeScanner> {
  if (!scanner) {
    scanner = getVolumeScanner();
    await scanner.initialize();
  }
  return scanner;
}

// ============ STATUS ============

// Get volume scanner status
volumeRoutes.get('/volume/status', async (c) => {
  const s = await getScanner();
  const status = s.getStatus();
  
  return c.json({
    success: true,
    ...status,
    config: {
      trackedTokens: TRACKED_TOKENS.map(t => t.symbol),
      scanInterval: '5 minutes',
      cooldown: '1 hour per token',
    },
  });
});

// ============ VOLUME DATA ============

// Get current top tokens by volume
volumeRoutes.get('/volume/top', async (c) => {
  const limit = parseInt(c.req.query('limit') || '10');
  const s = await getScanner();
  
  try {
    const top = await s.getTopByVolume(Math.min(limit, 20));
    
    return c.json({
      success: true,
      count: top.length,
      tokens: top.map(t => ({
        symbol: t.token.symbol,
        name: t.token.name,
        address: t.token.address,
        volume1h: t.volume1h,
        volume24h: t.volume24h,
        priceChange1h: t.priceChange1h,
      })),
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch volume data',
    }, 500);
  }
});

// ============ SPIKES ============

// Get recent volume spikes
volumeRoutes.get('/volume/spikes', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20');
  const severity = c.req.query('severity')?.toUpperCase();
  const symbol = c.req.query('symbol')?.toUpperCase();
  
  const s = await getScanner();
  let spikes = s.getRecentSpikes(50);
  
  // Filter by severity
  if (severity && ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'].includes(severity)) {
    spikes = spikes.filter(sp => sp.severity === severity);
  }
  
  // Filter by symbol
  if (symbol) {
    spikes = spikes.filter(sp => sp.token.symbol.toUpperCase() === symbol);
  }
  
  return c.json({
    success: true,
    count: Math.min(spikes.length, limit),
    spikes: spikes.slice(0, limit).map(sp => ({
      id: sp.id,
      token: {
        symbol: sp.token.symbol,
        name: sp.token.name,
        address: sp.token.address,
      },
      volumeSpikeMultiple: sp.volumeSpikeMultiple,
      volumeSpikePercent: sp.volumeSpikePercent,
      currentVolume1h: sp.currentVolume1h,
      avgHourlyVolume: sp.avgHourlyVolume,
      priceUsd: sp.priceUsd,
      priceChange1h: sp.priceChange1h,
      priceChange24h: sp.priceChange24h,
      buySellRatio: sp.buySellRatio,
      volumeVelocity: sp.volumeVelocity,
      spikeType: sp.spikeType,
      severity: sp.severity,
      detectedAt: sp.detectedAt.toISOString(),
      dexScreenerUrl: sp.dexScreenerUrl,
    })),
  });
});

// Get spike by ID
volumeRoutes.get('/volume/spikes/:id', async (c) => {
  const id = c.req.param('id');
  const s = await getScanner();
  const spikes = s.getRecentSpikes(100);
  const spike = spikes.find(sp => sp.id === id);
  
  if (!spike) {
    return c.json({ success: false, error: 'Spike not found' }, 404);
  }
  
  return c.json({
    success: true,
    spike,
  });
});

// ============ BASELINES ============

// Get volume baselines
volumeRoutes.get('/volume/baselines', async (c) => {
  const s = await getScanner();
  const baselines = s.getBaselines();
  
  return c.json({
    success: true,
    count: baselines.length,
    baselines: baselines.map(b => ({
      symbol: b.symbol,
      address: b.tokenAddress,
      avgHourlyVolume: b.avgHourlyVolume,
      avgHourlyTxns: b.avgHourlyTxns,
      dataPoints: b.dataPoints,
      lastUpdated: b.lastUpdated,
    })),
  });
});

// ============ ALERTS ============

// Subscribe to alerts
volumeRoutes.post('/volume/alerts/subscribe', async (c) => {
  try {
    const body = await c.req.json();
    const { chatId, minSeverity, tokens } = body;
    
    if (!chatId) {
      return c.json({ success: false, error: 'chatId is required' }, 400);
    }
    
    const severity = ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'].includes(minSeverity?.toUpperCase())
      ? minSeverity.toUpperCase()
      : 'MEDIUM';
    
    const s = await getScanner();
    s.subscribe(chatId, severity as any, tokens);
    
    return c.json({
      success: true,
      message: `Subscribed chat ${chatId} to volume alerts`,
      subscription: {
        chatId,
        minSeverity: severity,
        tokens: tokens || 'all',
      },
    }, 201);
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request',
    }, 400);
  }
});

// Unsubscribe from alerts
volumeRoutes.delete('/volume/alerts/subscribe/:chatId', async (c) => {
  const chatId = c.req.param('chatId');
  const s = await getScanner();
  const removed = s.unsubscribe(chatId);
  
  if (!removed) {
    return c.json({ success: false, error: 'Subscription not found' }, 404);
  }
  
  return c.json({
    success: true,
    message: `Unsubscribed chat ${chatId} from volume alerts`,
  });
});

// Get subscription status
volumeRoutes.get('/volume/alerts/subscribe/:chatId', async (c) => {
  const chatId = c.req.param('chatId');
  const s = await getScanner();
  const sub = s.getSubscription(chatId);
  
  if (!sub) {
    return c.json({ success: false, error: 'Not subscribed' }, 404);
  }
  
  return c.json({
    success: true,
    subscription: sub,
  });
});

// Get all subscriptions
volumeRoutes.get('/volume/alerts/subscriptions', async (c) => {
  await storage.load();
  const subs = storage.getSubscriptions();
  
  return c.json({
    success: true,
    count: subs.length,
    subscriptions: subs,
  });
});

// ============ CONTROLS ============

// Trigger a manual scan
volumeRoutes.post('/volume/scan', async (c) => {
  const s = await getScanner();
  
  console.log('[API] Triggering manual volume scan...');
  const result = await s.scan();
  
  return c.json({
    success: true,
    message: 'Volume scan completed',
    ...result,
    spikes: result.spikes.map(sp => ({
      token: sp.token.symbol,
      volumeSpike: `${sp.volumeSpikeMultiple.toFixed(1)}x`,
      priceChange: `${sp.priceChange1h.toFixed(2)}%`,
      severity: sp.severity,
      url: sp.dexScreenerUrl,
    })),
  });
});

// Start the scanner
volumeRoutes.post('/volume/start', async (c) => {
  const s = await getScanner();
  s.start();
  
  return c.json({
    success: true,
    message: 'Volume scanner started',
    status: s.getStatus(),
  });
});

// Stop the scanner
volumeRoutes.post('/volume/stop', async (c) => {
  const s = await getScanner();
  s.stop();
  
  return c.json({
    success: true,
    message: 'Volume scanner stopped',
    status: s.getStatus(),
  });
});

// ============ TRACKED TOKENS ============

// Get tracked tokens
volumeRoutes.get('/volume/tokens', (c) => {
  return c.json({
    success: true,
    count: TRACKED_TOKENS.length,
    tokens: TRACKED_TOKENS.map(t => ({
      symbol: t.symbol,
      name: t.name,
      address: t.address,
    })),
  });
});

export default volumeRoutes;
export { getScanner };
