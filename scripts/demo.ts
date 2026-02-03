// MORPHEUS Demo Script

import 'dotenv/config';
import { MorpheusEngine, KNOWN_TOKENS, runTechnicalAnalysis } from '../research-engine/src/index.js';

async function demo() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║           MORPHEUS Demo Script           ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  const engine = new MorpheusEngine();

  // Demo tokens to analyze
  const demoTokens = ['SOL', 'JUP', 'RAY', 'BONK', 'WIF'];

  for (const symbol of demoTokens) {
    const token = KNOWN_TOKENS[symbol as keyof typeof KNOWN_TOKENS];
    
    if (!token) {
      console.log(`Token ${symbol} not found`);
      continue;
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`Analyzing ${token.name} (${token.symbol})`);
    console.log('='.repeat(50));

    const result = await engine.analyzeToken(token.address);

    if (result.analysis) {
      console.log('\n📊 Technical Analysis:');
      console.log(result.analysis.summary);
      
      console.log('\n📈 RSI:', result.analysis.analysis.rsi);
      console.log('📉 MACD:', {
        macd: result.analysis.analysis.macd.macd,
        signal: result.analysis.analysis.macd.signal,
        trend: result.analysis.analysis.macd.trend,
      });
      console.log('📊 Trend:', {
        direction: result.analysis.analysis.trend.direction,
        strength: result.analysis.analysis.trend.strength,
      });
    }

    if (result.signal) {
      console.log('\n🎯 Generated Signal:');
      console.log(`  Action: ${result.signal.action}`);
      console.log(`  Entry: $${result.signal.entry}`);
      console.log(`  Targets: ${result.signal.targets.map(t => `$${t}`).join(', ')}`);
      console.log(`  Stop Loss: $${result.signal.stopLoss}`);
      console.log(`  Confidence: ${result.signal.confidence}%`);
      console.log(`  Risk Level: ${result.signal.riskLevel}`);
      console.log(`  Timeframe: ${result.signal.timeframe}`);
    } else {
      console.log('\n⏸️  No signal generated (conditions not met)');
    }

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n\n✅ Demo complete!');
}

demo().catch(console.error);
