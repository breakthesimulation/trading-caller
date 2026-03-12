// Test the new confluence-based strategy across multiple tokens
import { TradingCallerEngine, KNOWN_TOKENS } from '../research-engine/src/index.js';

const engine = new TradingCallerEngine();

// Test fewer tokens due to GeckoTerminal rate limits (30 req/min, ~4 req/token)
const tokensToTest = ['SOL', 'JUP', 'BONK', 'WIF'];

async function testStrategy() {
  console.log('=== Testing Confluence-Based Strategy ===\n');

  let signalCount = 0;
  let testedCount = 0;

  for (const sym of tokensToTest) {
    const token = KNOWN_TOKENS[sym];
    if (!token) {
      console.log(`${sym}: not in KNOWN_TOKENS, skipping`);
      continue;
    }

    console.log(`\n--- ${sym} (${token.address.slice(0, 8)}...) ---`);

    try {
      const result = await engine.analyzeToken(token.address);
      testedCount++;

      if (result.analysis) {
        const a = result.analysis.analysis;
        console.log(`  RSI: ${a.rsi.value.toFixed(1)} (${a.rsi.signal})`);
        console.log(`  Trend: ${a.trend.direction} strength=${a.trend.strength.toFixed(0)}%`);
        console.log(`  MACD: ${a.macd.trend}, crossover=${a.macd.crossover || 'none'}`);
      } else {
        console.log('  No analysis (data unavailable)');
      }

      if (result.signal) {
        signalCount++;
        const s = result.signal;
        console.log(`  >>> SIGNAL: ${s.action} confidence=${s.confidence}%`);
        console.log(`  Entry: $${s.entry}`);
        console.log(`  Stop: $${s.stopLoss}`);
        console.log(`  Targets: ${s.targets.map(t => '$' + t).join(', ')}`);
        console.log(`  Confluence: ${s.indicators?.confluence_count} factors`);
        console.log(`  ATR: ${s.indicators?.atr?.toFixed(4)}`);
        console.log(`  Risk: ${s.riskLevel}`);
      } else {
        console.log('  No signal (insufficient confluence or data)');
      }
    } catch (error) {
      console.log(`  Error: ${error}`);
    }

    // Wait 15s between tokens to avoid GeckoTerminal rate limits (30 req/min)
    await new Promise(r => setTimeout(r, 15000));
  }

  console.log(`\n=== Summary ===`);
  console.log(`Tested: ${testedCount} tokens`);
  console.log(`Signals generated: ${signalCount}`);
  console.log(`Signal rate: ${testedCount > 0 ? ((signalCount / testedCount) * 100).toFixed(0) : 0}%`);
  console.log(`\nThe low signal rate is intentional — only high-confluence setups pass.`);
}

testStrategy().catch(console.error);
