// Test Signal Generation with Mock Data

import { generateSignal } from '../research-engine/src/signals/generator.js';
import { runTechnicalAnalysis } from '../research-engine/src/technical/index.js';
import type { OHLCV, Token } from '../research-engine/src/signals/types.js';

// Generate mock OHLCV data
function generateMockOHLCV(
  basePrice: number,
  candles: number,
  trend: 'up' | 'down' | 'sideways',
  volatility: number = 0.02
): OHLCV[] {
  const data: OHLCV[] = [];
  let price = basePrice;
  const now = Date.now();

  for (let i = 0; i < candles; i++) {
    // Trend bias
    let trendBias = 0;
    if (trend === 'up') trendBias = volatility * 0.3;
    if (trend === 'down') trendBias = -volatility * 0.3;

    // Random movement
    const change = (Math.random() - 0.5) * volatility * 2 + trendBias;
    const open = price;
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    const volume = Math.random() * 1000000 + 500000;

    data.push({
      timestamp: now - (candles - i) * 60 * 60 * 1000, // Hourly candles
      open,
      high,
      low,
      close,
      volume,
    });

    price = close;
  }

  return data;
}

// Test scenarios
const scenarios = [
  {
    name: 'Oversold Bounce (RSI < 30, uptrend starting)',
    token: { symbol: 'TEST1', name: 'Test Token 1', address: '0x1' },
    setup: () => {
      // Generate downtrend then uptick
      const down = generateMockOHLCV(100, 80, 'down', 0.03);
      const up = generateMockOHLCV(down[down.length - 1].close, 20, 'up', 0.02);
      return [...down, ...up];
    },
  },
  {
    name: 'Overbought Pullback (RSI > 70, downtrend starting)',
    token: { symbol: 'TEST2', name: 'Test Token 2', address: '0x2' },
    setup: () => {
      const up = generateMockOHLCV(100, 80, 'up', 0.03);
      const down = generateMockOHLCV(up[up.length - 1].close, 20, 'down', 0.02);
      return [...up, ...down];
    },
  },
  {
    name: 'Strong Uptrend (trend following)',
    token: { symbol: 'TEST3', name: 'Test Token 3', address: '0x3' },
    setup: () => generateMockOHLCV(100, 100, 'up', 0.025),
  },
  {
    name: 'Strong Downtrend (short opportunity)',
    token: { symbol: 'TEST4', name: 'Test Token 4', address: '0x4' },
    setup: () => generateMockOHLCV(100, 100, 'down', 0.025),
  },
  {
    name: 'Sideways Consolidation (no signal expected)',
    token: { symbol: 'TEST5', name: 'Test Token 5', address: '0x5' },
    setup: () => generateMockOHLCV(100, 100, 'sideways', 0.015),
  },
];

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              MORPHEUS Signal Generation Tests                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  for (const scenario of scenarios) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📊 Scenario: ${scenario.name}`);
    console.log('═'.repeat(60));

    const hourlyData = scenario.setup();
    
    // Create multi-timeframe data (simulate by aggregating)
    const fourHourData = aggregateOHLCV(hourlyData, 4);
    const dailyData = aggregateOHLCV(hourlyData, 24);

    const ohlcv = {
      '1H': hourlyData,
      '4H': fourHourData,
      '1D': dailyData,
    };

    // Run technical analysis
    const analysis = runTechnicalAnalysis(fourHourData);
    
    console.log('\n📈 Technical Analysis (4H):');
    console.log(`   RSI: ${analysis.analysis.rsi.value} (${analysis.analysis.rsi.signal})`);
    console.log(`   MACD: ${analysis.analysis.macd.histogram.toFixed(4)} (${analysis.analysis.macd.trend})`);
    console.log(`   Trend: ${analysis.analysis.trend.direction} (strength: ${analysis.analysis.trend.strength})`);
    console.log(`   Support: ${analysis.analysis.support.slice(-3).map(s => s.toFixed(2)).join(', ')}`);
    console.log(`   Resistance: ${analysis.analysis.resistance.slice(0, 3).map(r => r.toFixed(2)).join(', ')}`);

    // Generate signal
    const signal = generateSignal({
      token: scenario.token as Token,
      ohlcv,
    });

    if (signal) {
      console.log('\n🎯 Generated Signal:');
      console.log(`   Action: ${signal.action}`);
      console.log(`   Entry: $${signal.entry.toFixed(4)}`);
      console.log(`   Targets: ${signal.targets.map(t => `$${t.toFixed(2)}`).join(' → ')}`);
      console.log(`   Stop Loss: $${signal.stopLoss.toFixed(4)}`);
      console.log(`   Confidence: ${signal.confidence}%`);
      console.log(`   Risk Level: ${signal.riskLevel}`);
      console.log(`   Timeframe: ${signal.timeframe}`);
      console.log(`   Reasoning: ${signal.reasoning.technical}`);
    } else {
      console.log('\n⏸️  No signal generated (conditions not met for clear trade)');
    }
  }

  console.log('\n\n✅ All tests complete!');
}

// Helper: Aggregate OHLCV to higher timeframe
function aggregateOHLCV(data: OHLCV[], period: number): OHLCV[] {
  const aggregated: OHLCV[] = [];
  
  for (let i = 0; i < data.length; i += period) {
    const slice = data.slice(i, i + period);
    if (slice.length === 0) continue;

    aggregated.push({
      timestamp: slice[0].timestamp,
      open: slice[0].open,
      high: Math.max(...slice.map(c => c.high)),
      low: Math.min(...slice.map(c => c.low)),
      close: slice[slice.length - 1].close,
      volume: slice.reduce((sum, c) => sum + c.volume, 0),
    });
  }

  return aggregated;
}

runTests().catch(console.error);
