// Trading Caller API Server

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import 'dotenv/config';

import { TradingCallerEngine, KNOWN_TOKENS } from '../../research-engine/src/index.js';
import type { TradingSignal, AnalystCall, AnalystStats } from '../../research-engine/src/signals/types.js';

// Optional modules - loaded lazily to avoid startup failures
let hackathon: any = null;
let scheduler: any = null;
let db: any = null;
let tracker: any = null;
let learner: any = null;
let modulesLoaded = false;

async function loadOptionalModules() {
  if (modulesLoaded) return;
  try {
    const [hackathonMod, schedulerMod, dbMod, trackerMod, learnerMod] = await Promise.all([
      import('../../agent/hackathon.js').catch(() => null),
      import('../../agent/scheduler.js').catch(() => null),
      import('../../db/index.js').catch(() => null),
      import('../../learning/tracker.js').catch(() => null),
      import('../../learning/learner.js').catch(() => null),
    ]);
    hackathon = hackathonMod?.default || null;
    scheduler = schedulerMod?.default || null;
    db = dbMod?.db || null;
    tracker = trackerMod?.default || null;
    learner = learnerMod?.default || null;
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

// In-memory storage (would be database in production)
const calls: AnalystCall[] = [];
const analysts: Map<string, AnalystStats> = new Map();
const webhooks: Map<string, string[]> = new Map();

// ============ PUBLIC ENDPOINTS ============

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'Trading Caller',
    tagline: 'Free your mind — AI trading calls for Solana',
    version: '1.0.0',
    status: 'operational',
    endpoints: {
      signals: '/signals/latest',
      history: '/signals/history',
      analysis: '/tokens/:symbol/analysis',
      unlocks: '/unlocks/upcoming',
      leaderboard: '/leaderboard',
      subscribe: 'POST /subscribe',
      feed: 'WS /feed',
    },
  });
});

// Get latest signals
app.get('/signals/latest', (c) => {
  const limit = parseInt(c.req.query('limit') || '10');
  const action = c.req.query('action'); // Filter by action type
  
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
app.get('/signals/history', (c) => {
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
app.get('/tokens/:symbol/analysis', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  
  // Find token address
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

// Get upcoming token unlocks
app.get('/unlocks/upcoming', (c) => {
  // Placeholder - would integrate with unlock tracking API
  return c.json({
    success: true,
    message: 'Token unlock tracking coming soon',
    unlocks: [],
  });
});

// Get leaderboard
app.get('/leaderboard', (c) => {
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

// ============ ANALYST ENDPOINTS ============

// Submit a trading call
app.post('/calls', async (c) => {
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
    
    // Update analyst stats
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
app.get('/calls/:id', (c) => {
  const id = c.req.param('id');
  const call = calls.find(c => c.id === id);
  
  if (!call) {
    return c.json({ success: false, error: 'Call not found' }, 404);
  }
  
  return c.json({ success: true, call });
});

// Get analyst stats
app.get('/analysts/:id/stats', (c) => {
  const id = c.req.param('id');
  const stats = analysts.get(id);
  
  if (!stats) {
    return c.json({ success: false, error: 'Analyst not found' }, 404);
  }
  
  return c.json({ success: true, stats });
});

// ============ SUBSCRIPTION ENDPOINTS ============

// Subscribe to webhooks
app.post('/subscribe', async (c) => {
  try {
    const body = await c.req.json();
    const { webhook, events } = body;
    
    if (!webhook) {
      return c.json({ 
        success: false, 
        error: 'Missing webhook URL' 
      }, 400);
    }
    
    const subscriberId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    webhooks.set(subscriberId, events || ['signals']);
    
    return c.json({
      success: true,
      subscriberId,
      webhook,
      events: events || ['signals'],
    }, 201);
  } catch (error) {
    return c.json({ 
      success: false, 
      error: 'Invalid request body' 
    }, 400);
  }
});

// ============ ENGINE STATUS ============

app.get('/status', (c) => {
  const status = engine.status();
  const schedulerStatus = scheduler?.getStatus?.() || { status: 'not_loaded' };
  
  return c.json({
    success: true,
    engine: status,
    scheduler: schedulerStatus,
    api: {
      calls: calls.length,
      analysts: analysts.size,
      subscribers: webhooks.size,
    },
  });
});

// ============ HACKATHON ENDPOINTS ============

// Get hackathon agent status
app.get('/hackathon/status', async (c) => {
  if (!hackathon) {
    return c.json({ success: false, error: 'Hackathon module not loaded' }, 503);
  }
  try {
    const status = await hackathon.getStatus();
    return c.json({ success: true, ...status });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Get our project
app.get('/hackathon/project', async (c) => {
  if (!hackathon) {
    return c.json({ success: false, error: 'Hackathon module not loaded' }, 503);
  }
  try {
    const { project } = await hackathon.getMyProject();
    return c.json({ success: true, project });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Get leaderboard
app.get('/hackathon/leaderboard', async (c) => {
  if (!hackathon) {
    return c.json({ success: false, error: 'Hackathon module not loaded' }, 503);
  }
  try {
    const leaderboard = await hackathon.getLeaderboard();
    return c.json({ success: true, ...leaderboard });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// ============ LEARNING ENDPOINTS ============

// Get performance stats
app.get('/learning/stats', (c) => {
  if (!tracker) {
    return c.json({ success: false, error: 'Learning module not loaded' }, 503);
  }
  const stats = tracker.getPerformanceStats();
  return c.json({ success: true, stats });
});

// Get token performance
app.get('/learning/tokens', (c) => {
  if (!tracker) {
    return c.json({ success: false, error: 'Learning module not loaded' }, 503);
  }
  const performance = tracker.getTokenPerformance();
  return c.json({ success: true, ...performance });
});

// Get learning insights
app.get('/learning/insights', async (c) => {
  if (!learner) {
    return c.json({ success: false, error: 'Learning module not loaded' }, 503);
  }
  try {
    const insights = await learner.generateInsights();
    return c.json({ success: true, insights });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Get indicator patterns
app.get('/learning/patterns', (c) => {
  if (!learner) {
    return c.json({ success: false, error: 'Learning module not loaded' }, 503);
  }
  const indicatorPatterns = learner.analyzeIndicatorPatterns();
  const tokenPatterns = learner.analyzeTokenPerformance();
  return c.json({ success: true, indicatorPatterns, tokenPatterns });
});

// ============ SCHEDULER ENDPOINTS ============

// Get scheduler status
app.get('/scheduler/status', (c) => {
  if (!scheduler) {
    return c.json({ success: false, error: 'Scheduler not loaded' }, 503);
  }
  const status = scheduler.getStatus();
  return c.json({ success: true, ...status });
});

// Trigger a task manually
app.post('/scheduler/trigger/:task', async (c) => {
  if (!scheduler) {
    return c.json({ success: false, error: 'Scheduler not loaded' }, 503);
  }
  
  const task = c.req.param('task') as 'heartbeat' | 'outcomeCheck' | 'forumEngagement' | 'marketScan' | 'learning';
  
  const validTasks = ['heartbeat', 'outcomeCheck', 'forumEngagement', 'marketScan', 'learning'];
  if (!validTasks.includes(task)) {
    return c.json({ success: false, error: `Invalid task: ${task}` }, 400);
  }

  try {
    await scheduler.triggerTask(task);
    return c.json({ success: true, message: `Task ${task} triggered` });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

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
    
    if (hackathon) {
      console.log('[API] Initializing hackathon agent...');
      const { registered, project } = await hackathon.initializeAgent();
      
      if (registered) {
        if (!project) {
          console.log('[API] Creating hackathon project...');
          await hackathon.ensureProject();
        }
        
        if (scheduler?.start) {
          console.log('[API] Starting scheduler...');
          scheduler.start();
        }
      }
    } else {
      console.log('[API] Hackathon module not available, skipping...');
    }
  } catch (error) {
    console.error('[API] Hackathon initialization failed:', error);
  }
}, 5000); // Delay to let server start first

export default {
  port,
  fetch: app.fetch,
};
