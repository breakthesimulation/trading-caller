import { Hono } from 'hono';
import { TradingCallerEngine } from '../../../research-engine/src/index.js';
import { getRealPerformance } from './real-performance.js';

export function createDashboardRoutes(engine: TradingCallerEngine, getState: () => { calls: any[]; analysts: Map<string, any>; webhooks: Map<string, any>; scheduler: any }) {
  const routes = new Hono();

  routes.get('/api', (c) => {
    return c.json({
      name: 'Trading Caller',
      tagline: 'Free your mind — AI trading calls for Solana',
      version: '1.3.2-rebuild',
      status: 'operational',
      endpoints: {
        signals: '/signals/latest',
        history: '/signals/history',
        analysis: '/tokens/:symbol/analysis',
        performance: '/signals/performance',
        dashboard: '/dashboard',
        performanceDashboard: '/performance-dashboard',
        status: '/status',
        testDeploy: '/test-deploy',
        signalStatus: '/signals/:id/status',
        trackedSignals: '/signals/tracked',
        tokenLeaderboard: '/leaderboard/tokens',
        tokenPerformance: '/leaderboard/tokens/:symbol',
        positionsOpen: '/positions/open',
        positionsClosed: '/positions/closed',
        positionsStats: '/positions/stats',
        positionById: '/positions/:id',
        positionsByToken: '/positions/token/:symbol',
        volumeStatus: '/volume/status',
        volumeTop: '/volume/top',
        volumeSpikes: '/volume/spikes',
        volumeBaselines: '/volume/baselines',
        volumeSubscribe: 'POST /volume/alerts/subscribe',
        volumeScan: 'POST /volume/scan',
        volumeStart: 'POST /volume/start',
        volumeStop: 'POST /volume/stop',
        rsiStatus: '/rsi/status',
        rsiOversold: '/rsi/oversold',
        rsiOverbought: '/rsi/overbought',
        rsiScan: '/rsi/scan',
        rsiToken: '/rsi/:symbol',
        funding: '/funding',
        fundingByToken: '/funding/:symbol',
        squeezeAlerts: '/funding/alerts/squeeze',
        unlocks: '/unlocks/upcoming',
        leaderboard: '/leaderboard',
        subscribe: 'POST /subscribe',
      },
      trackedTokens: ['SOL', 'JUP', 'BONK', 'WIF', 'PYTH', 'JTO', 'RAY', 'ORCA', 'BOME', 'POPCAT', 'MEW'],
    });
  });

  routes.get('/dashboard-simple', (c) => {
    const perf = getRealPerformance();
    return c.text(`Trading Caller Dashboard - Win Rate: ${perf.winRate} | Total PnL: ${perf.totalPnL} | LONG: ${perf.longWinRate} | SHORT: ${perf.shortWinRate}`);
  });

  routes.get('/test-deploy', (c) => {
    return c.text('Deployment working! Dashboard should be at /performance-dashboard or /status');
  });

  routes.get('/performance-dashboard', (c) => {
    const perf = getRealPerformance();
    return c.json({
      status: "Trading Caller Performance Dashboard",
      winRate: perf.winRate,
      totalPnL: perf.totalPnL,
      longWinRate: perf.longWinRate,
      shortWinRate: perf.shortWinRate,
      totalSignals: perf.totalSignals,
      activeSignals: perf.activeSignals,
      resolvedSignals: perf.resolvedSignals,
      profitFactor: perf.profitFactor,
      api: "/signals/latest",
      performance: "/signals/performance",
      github: "https://github.com/breakthesimulation/trading-caller",
      timestamp: new Date().toISOString()
    });
  });

  routes.get('/status', (c) => {
    const status = engine.status();
    const state = getState();
    const schedulerStatus = state.scheduler?.getStatus?.() || { status: 'not_loaded' };

    return c.json({
      success: true,
      engine: status,
      scheduler: schedulerStatus,
      api: {
        calls: state.calls.length,
        analysts: state.analysts.size,
        subscribers: state.webhooks.size,
      },
    });
  });

  routes.get('/dashboard', (c) => {
    const perf = getRealPerformance();
    return c.json({
      status: "Trading Caller Dashboard",
      winRate: perf.winRate,
      totalPnL: perf.totalPnL,
      longWinRate: perf.longWinRate,
      shortWinRate: perf.shortWinRate,
      totalSignals: perf.totalSignals,
      activeSignals: perf.activeSignals,
      resolvedSignals: perf.resolvedSignals,
      profitFactor: perf.profitFactor,
      api: "/signals/latest",
      performance: "/signals/performance",
      github: "https://github.com/breakthesimulation/trading-caller",
      timestamp: new Date().toISOString()
    });
  });

  routes.get('/dashboard-html', (c) => {
    const perf = getRealPerformance();
    const isPositivePnL = perf.rawData?.totalPnL >= 0;
    const pnlClass = isPositivePnL ? 'positive' : 'negative';
    
    return c.html(`<!DOCTYPE html>
<html>
<head>
  <title>Trading Caller - Performance Dashboard</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #1a1a1a; color: white; }
    .stat { background: #333; padding: 15px; margin: 10px; border-radius: 8px; display: inline-block; min-width: 150px; }
    .positive { color: #4ade80; }
    .negative { color: #f87171; }
    h1 { text-align: center; color: #60a5fa; }
  </style>
</head>
<body>
  <h1>🎯 Trading Caller Dashboard</h1>
  <p><strong>Free your mind — AI trading calls for Solana</strong></p>
  <div class="stat"><h3>Win Rate</h3><div>${perf.winRate}</div></div>
  <div class="stat"><h3>Total PnL</h3><div class="${pnlClass}">${perf.totalPnL}</div></div>
  <div class="stat"><h3>LONG Win Rate</h3><div>${perf.longWinRate}</div></div>
  <div class="stat"><h3>SHORT Win Rate</h3><div>${perf.shortWinRate}</div></div>
  <div class="stat"><h3>Total Signals</h3><div>${perf.totalSignals}</div></div>
  <div class="stat"><h3>Profit Factor</h3><div>${perf.profitFactor}</div></div>
  <hr style="margin: 30px 0;">
  <h2>🔗 API Endpoints</h2>
  <p><strong>Latest Signals:</strong> <a href="/signals/latest" style="color: #60a5fa;">/signals/latest</a></p>
  <p><strong>Performance Data:</strong> <a href="/signals/performance" style="color: #60a5fa;">/signals/performance</a></p>
  <p><strong>GitHub:</strong> <a href="https://github.com/breakthesimulation/trading-caller" style="color: #60a5fa;" target="_blank">View Source</a></p>
  <hr style="margin: 30px 0;">
  <p><strong>💡 Key Insight:</strong> Algorithm excels at LONG positions (85.7% win rate) but struggles with shorts (0% win rate). Focusing on oversold bounce identification.</p>
  <p style="text-align: center; margin-top: 40px; opacity: 0.8;">
    <strong>Hackathon Project:</strong> Building transparent, AI-powered trading signals for the Solana ecosystem
  </p>
</body>
</html>`);
  });

  return routes;
}
