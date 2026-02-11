import { Hono } from 'hono';
import { TradingCallerEngine } from '../../../research-engine/src/index.js';
import funding from '../../../research-engine/src/data/funding.js';

function interpretFunding(analysis: any): string {
  const { avgFundingRate, sentiment, squeezePotential, squeezeAlert } = analysis;

  let interpretation = '';

  if (squeezeAlert && squeezePotential === 'SHORT_SQUEEZE') {
    interpretation = `⚠️ SHORT SQUEEZE ALERT: Funding at ${avgFundingRate.toFixed(4)}% with heavy shorting. Potential bounce incoming.`;
  } else if (squeezeAlert && squeezePotential === 'LONG_SQUEEZE') {
    interpretation = `⚠️ LONG SQUEEZE ALERT: Funding at ${avgFundingRate.toFixed(4)}% with heavy longing. Potential dump incoming.`;
  } else if (squeezePotential === 'SHORT_SQUEEZE') {
    interpretation = `📊 Short squeeze setup: Negative funding (${avgFundingRate.toFixed(4)}%) with shorts piling up.`;
  } else if (squeezePotential === 'LONG_SQUEEZE') {
    interpretation = `📊 Long squeeze setup: High funding (${avgFundingRate.toFixed(4)}%) with longs crowded.`;
  } else if (sentiment === 'EXTREME_LONG') {
    interpretation = `🔴 Extremely bullish positioning (${avgFundingRate.toFixed(4)}%). Contrarian bearish signal.`;
  } else if (sentiment === 'EXTREME_SHORT') {
    interpretation = `🟢 Extremely bearish positioning (${avgFundingRate.toFixed(4)}%). Contrarian bullish signal.`;
  } else if (sentiment === 'BULLISH') {
    interpretation = `📈 Bullish positioning (${avgFundingRate.toFixed(4)}%).`;
  } else if (sentiment === 'BEARISH') {
    interpretation = `📉 Bearish positioning (${avgFundingRate.toFixed(4)}%).`;
  } else {
    interpretation = `➖ Neutral funding (${avgFundingRate.toFixed(4)}%).`;
  }

  return interpretation;
}

export function createMarketRoutes(engine: TradingCallerEngine, performanceTracker: any) {
  const routes = new Hono();

  // Get funding rate analysis for a token
  routes.get('/funding/:symbol', async (c) => {
    const symbol = c.req.param('symbol').toUpperCase();

    try {
      const analysis = await funding.analyzeFunding(symbol);

      if (!analysis) {
        return c.json({
          success: false,
          error: `No funding data available for ${symbol}. Try SOL, JUP, BONK, or WIF.`,
        }, 404);
      }

      return c.json({
        success: true,
        ...analysis,
        interpretation: interpretFunding(analysis),
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch funding data',
      }, 500);
    }
  });

  // Get squeeze alerts
  routes.get('/funding/alerts/squeeze', async (c) => {
    const symbols = ['SOL', 'JUP', 'BONK', 'WIF', 'PYTH', 'JTO', 'RAY'];

    try {
      const alerts = await funding.getSqueezeAlerts(symbols);

      return c.json({
        success: true,
        count: alerts.length,
        alerts: alerts.map(a => ({
          ...a,
          interpretation: interpretFunding(a),
        })),
        scannedTokens: symbols,
        scanTime: new Date().toISOString(),
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to scan for squeezes',
      }, 500);
    }
  });

  // Get funding summary for all tracked tokens
  routes.get('/funding', async (c) => {
    const symbols = ['SOL', 'JUP', 'BONK', 'WIF', 'PYTH', 'JTO', 'RAY', 'ORCA'];

    try {
      const analyses = await funding.getMultipleFundingAnalysis(symbols);

      const results = Array.from(analyses.entries()).map(([symbol, data]) => ({
        symbol,
        ...data,
        interpretation: interpretFunding(data),
      }));

      results.sort((a, b) => Math.abs(b.avgFundingRate) - Math.abs(a.avgFundingRate));

      return c.json({
        success: true,
        count: results.length,
        funding: results,
        scanTime: new Date().toISOString(),
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch funding data',
      }, 500);
    }
  });

  // Get comprehensive market overview
  routes.get('/market/overview', async (c) => {
    try {
      const signals = engine.getLatestSignals(10);

      const fundingSymbols = ['SOL', 'JUP', 'BONK', 'WIF', 'JTO'];
      const fundingData = await funding.getMultipleFundingAnalysis(fundingSymbols);
      const squeezAlerts = await funding.getSqueezeAlerts(fundingSymbols);

      const longSignals = signals.filter(s => s.action === 'LONG').length;
      const shortSignals = signals.filter(s => s.action === 'SHORT').length;
      const marketSentiment = longSignals > shortSignals ? 'BULLISH'
        : shortSignals > longSignals ? 'BEARISH'
        : 'NEUTRAL';

      return c.json({
        success: true,
        timestamp: new Date().toISOString(),
        overview: {
          totalSignals: signals.length,
          longSignals,
          shortSignals,
          marketSentiment,
          avgConfidence: signals.length > 0
            ? Math.round(signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length)
            : 0,
        },
        topSignals: signals.slice(0, 5).map(s => ({
          token: s.token.symbol,
          action: s.action,
          confidence: s.confidence,
          entry: s.entry,
          targets: s.targets,
          stopLoss: s.stopLoss,
        })),
        fundingSummary: Array.from(fundingData.entries()).map(([symbol, data]) => ({
          symbol,
          rate: data.avgFundingRate.toFixed(4) + '%',
          sentiment: data.sentiment,
          squeezeRisk: data.squeezePotential,
        })),
        squeezeAlerts: squeezAlerts.map(a => ({
          symbol: a.symbol,
          type: a.squeezePotential,
          fundingRate: a.avgFundingRate.toFixed(4) + '%',
          interpretation: interpretFunding(a),
        })),
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate overview',
      }, 500);
    }
  });

  // Force a new market scan
  routes.post('/market/scan', async (c) => {
    try {
      console.log('[API] Triggering manual market scan...');
      const signals = await engine.scan();

      let tracked = 0;
      for (const signal of signals) {
        if (signal.action === 'HOLD' || signal.action === 'AVOID') {
          continue;
        }

        const trackedSignal = performanceTracker?.trackSignal({
          id: signal.id,
          token: signal.token,
          action: signal.action as 'LONG' | 'SHORT',
          entry: signal.entry,
          targets: signal.targets,
          stopLoss: signal.stopLoss,
          confidence: signal.confidence,
          timeframe: signal.timeframe,
          reasoning: signal.reasoning?.technical,
          indicators: signal.indicators || {},
        });

        if (trackedSignal) {
          tracked++;
        }
      }

      console.log(`[API] Market scan complete: ${signals.length} signals, ${tracked} tracked`);

      return c.json({
        success: true,
        message: 'Market scan completed',
        signalsGenerated: signals.length,
        signalsTracked: tracked,
        topSignals: signals.slice(0, 5).map(s => ({
          token: s.token.symbol,
          action: s.action,
          confidence: s.confidence,
          reasoning: s.reasoning?.technical,
        })),
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Scan failed',
      }, 500);
    }
  });

  // Get upcoming token unlocks (placeholder)
  routes.get('/unlocks/upcoming', (c) => {
    return c.json({
      success: true,
      message: 'Token unlock tracking coming soon',
      unlocks: [],
    });
  });

  return routes;
}
