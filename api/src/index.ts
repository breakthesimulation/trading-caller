// Trading Caller API Server

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { serveStatic } from '@hono/node-server/serve-static';
import { serve } from '@hono/node-server';
import 'dotenv/config';

import { TradingCallerEngine } from '../../research-engine/src/index.js';

// Existing route modules
import performanceRoutes from './performance-routes.js';
import volumeRoutes, { getScanner } from '../../volume-scanner/src/routes.js';
import { rsiRoutes } from '../../oversold/src/index.js';
import { rsiMultiRoutes } from './rsi-multi.js';
import positionsRoutes from './positions-routes.js';
import forumActionsRoutes from './forum-actions.js';

// New route modules
import { createSignalRoutes } from './routes/signals.js';
import { createMarketRoutes } from './routes/market.js';
import { createDashboardRoutes } from './routes/dashboard.js';
import { createLearningRoutes } from './routes/learning.js';
import { createSchedulerRoutes } from './routes/scheduler.js';
import { createHackathonRoutes } from './routes/hackathon.js';
import { createGeckoRoutes } from './routes/gecko.js';
import { backtestRoutes } from '../../backtesting/src/index.js';

// Price update for live position tracking
import { getPrice } from '../../research-engine/src/data/jupiter.js';
import { storage as perfStorage } from '../../performance/storage.js';

// Optional modules - loaded lazily to avoid startup failures
let hackathon: any = null;
let scheduler: any = null;
let db: any = null;
let tracker: any = null;
let learner: any = null;
let performanceTracker: any = null;
let modulesLoaded = false;

async function loadOptionalModules() {
  if (modulesLoaded) return;
  try {
    const [hackathonMod, schedulerMod, dbMod, trackerMod, learnerMod, perfMod] = await Promise.all([
      import('../../agent/hackathon.js').catch(() => null),
      import('../../agent/scheduler.js').catch(() => null),
      import('../../db/index.js').catch(() => null),
      import('../../learning/tracker.js').catch(() => null),
      import('../../learning/learner.js').catch(() => null),
      import('../../performance/index.js').catch(() => null),
    ]);
    hackathon = hackathonMod?.default || null;
    scheduler = schedulerMod?.default || null;
    db = dbMod?.db || null;
    tracker = trackerMod?.default || null;
    learner = learnerMod?.default || null;
    performanceTracker = perfMod?.performanceTracker || null;
    modulesLoaded = true;
    console.log('[TradingCaller] Optional modules loaded');
  } catch (err) {
    console.warn('[TradingCaller] Optional module loading failed:', err);
  }
}

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());
app.use('*', prettyJSON());

// Initialize engine
const engine = new TradingCallerEngine();

// Connect scheduler to engine (if loaded)
if (scheduler?.setEngine) {
  scheduler.setEngine(engine);
}

// ============ MOUNT ROUTES ============

// Initialize route modules
const { routes: signalRoutes, calls, analysts, webhooks } = createSignalRoutes(engine);
const marketRoutes = createMarketRoutes(engine, performanceTracker);
const dashboardRoutes = createDashboardRoutes(engine, () => ({
  calls,
  analysts,
  webhooks,
  scheduler,
}));
const learningRoutes = createLearningRoutes(() => ({ tracker, learner }));
const schedulerRoutes = createSchedulerRoutes(() => scheduler);
const hackathonRoutes = createHackathonRoutes(() => hackathon, loadOptionalModules);
const geckoRoutes = createGeckoRoutes();

// Mount existing route modules
app.route('/', performanceRoutes);
app.route('/', volumeRoutes);
app.route('/', rsiMultiRoutes);
app.route('/', rsiRoutes);
app.route('/', positionsRoutes);
app.route('/forum-actions', forumActionsRoutes);

// Mount new route modules
app.route('/', signalRoutes);
app.route('/', marketRoutes);
app.route('/', dashboardRoutes);
app.route('/', learningRoutes);
app.route('/', schedulerRoutes);
app.route('/', backtestRoutes);
app.route('/', hackathonRoutes);
app.route('/', geckoRoutes);

// ============ STATIC FILES ============
app.get('/app.js', serveStatic({ path: './app.js' }));
app.get('/styles.css', serveStatic({ path: './styles.css' }));
app.get('/assets/*', serveStatic({ root: './' }));
app.get('/live', serveStatic({ path: './live-dashboard.html' }));
app.get('/positions-dashboard.html', serveStatic({ path: './positions-dashboard.html' }));
app.get('/backtesting-results.html', serveStatic({ path: './backtesting-results.html' }));
app.get('/modern-ui.css', serveStatic({ path: './modern-ui.css' }));
app.get('/rsi-enhancements.css', serveStatic({ path: './rsi-enhancements.css' }));
app.get('/keyboard-shortcuts.css', serveStatic({ path: './keyboard-shortcuts.css' }));
app.get('/oversold-positions.css', serveStatic({ path: './oversold-positions.css' }));
app.get('/cache-manager.js', serveStatic({ path: './cache-manager.js' }));
app.get('/', serveStatic({ path: './index.html' }));

// ============ START SERVER ============

const port = parseInt(process.env.PORT || '3000');

console.log('╔══════════════════════════════════════════╗');
console.log('║        Trading Caller API Server         ║');
console.log('║     "Free your mind" - Make the call     ║');
console.log('╚══════════════════════════════════════════╝');
console.log('');
console.log(`Starting server on port ${port}...`);

// Start engine in background
engine.start();

// Initialize optional modules and hackathon agent
setTimeout(async () => {
  try {
    await loadOptionalModules();

    // Start performance scheduler
    console.log('[API] Starting performance scheduler...');
    if (performanceTracker?.start) performanceTracker.start();

    // Start live price updates for active positions
    console.log('[API] Starting position price updater...');
    async function updatePositionPrices() {
      const active = perfStorage.getActiveSignals();
      if (active.length === 0) return;

      console.log(`[PriceUpdater] Updating prices for ${active.length} active positions...`);
      let updated = 0;

      for (const signal of active) {
        try {
          const price = await getPrice(signal.tokenAddress);
          if (price && price > 0) {
            perfStorage.updateCurrentPrice(signal.id, price);
            updated++;
          }
          await new Promise(r => setTimeout(r, 300));
        } catch (e) {
          // Skip silently
        }
      }

      if (updated > 0) {
        perfStorage.forceSave();
        console.log(`[PriceUpdater] Updated ${updated}/${active.length} position prices`);
      }
    }

    updatePositionPrices();
    setInterval(updatePositionPrices, 120000);

    // Initialize and start volume scanner
    console.log('[API] Initializing volume scanner...');
    try {
      const volumeScanner = await getScanner();
      volumeScanner.start();
      console.log('[API] Volume scanner started (scanning every 5 minutes)');
    } catch (volumeError) {
      console.error('[API] Volume scanner initialization failed (non-fatal):', volumeError);
    }

    // Start scheduler if available
    if (scheduler?.start) {
      console.log('[API] Starting main scheduler...');
      scheduler.start();
    }

    // Initialize hackathon agent
    if (hackathon) {
      console.log('[API] Initializing hackathon agent...');
      try {
        const { registered, project } = await hackathon.initializeAgent();
        if (registered && !project) {
          console.log('[API] Creating hackathon project...');
          await hackathon.ensureProject();
        }
      } catch (hackathonError) {
        console.error('[API] Hackathon initialization failed (non-fatal):', hackathonError);
      }
    } else {
      console.log('[API] Hackathon module not available, skipping...');
    }
  } catch (error) {
    console.error('[API] Module initialization failed:', error);
  }
}, 5000);

serve({
  fetch: app.fetch,
  port,
  hostname: '0.0.0.0',
});

console.log(`[TradingCaller] Server listening on http://0.0.0.0:${port}`);

export default app;
