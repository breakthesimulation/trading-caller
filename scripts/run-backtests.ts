// Run Comprehensive Backtests

import { BacktestEngine, ALL_STRATEGIES, getBacktestDB } from '../backtesting/src/index.js';
import type { BacktestConfig } from '../backtesting/src/types.js';

// Major tokens to test
const TOKENS = [
  { symbol: 'SOL', address: 'So11111111111111111111111111111111111111112', name: 'Solana' },
  { symbol: 'ETH', address: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', name: 'Ethereum (Portal)' },
  { symbol: 'BTC', address: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh', name: 'Bitcoin (Portal)' },
  { symbol: 'JUP', address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', name: 'Jupiter' },
  { symbol: 'WIF', address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', name: 'dogwifhat' },
];

async function runComprehensiveBacktests() {
  console.log('='.repeat(80));
  console.log('TRADING CALLER - COMPREHENSIVE BACKTESTING');
  console.log('='.repeat(80));
  console.log();

  const db = getBacktestDB();
  const results: any[] = [];

  // Test period: Last 90 days
  const endDate = new Date();
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  console.log(`📅 Test Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  console.log(`📊 Testing ${ALL_STRATEGIES.length} strategies on ${TOKENS.length} tokens`);
  console.log(`⏱️  Timeframe: 4H`);
  console.log();

  let totalTests = 0;
  let successfulTests = 0;
  let failedTests = 0;

  for (const token of TOKENS) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📈 Testing ${token.symbol} (${token.name})`);
    console.log(`${'─'.repeat(80)}\n`);

    for (const strategy of ALL_STRATEGIES) {
      totalTests++;
      
      try {
        console.log(`  ⚡ Running: ${strategy.name}...`);
        
        const config: BacktestConfig = {
          symbol: token.symbol,
          address: token.address,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          timeframe: '4H',
          initialCapital: 10000,
          positionSize: 10,
          strategy,
        };

        const engine = new BacktestEngine(config);
        const result = await engine.run();

        // Save to database
        db.saveResult(result);

        // Store summary
        results.push({
          token: token.symbol,
          strategy: strategy.name,
          winRate: result.metrics.winRate,
          totalReturn: result.metrics.totalReturn,
          profitFactor: result.metrics.profitFactor,
          totalTrades: result.metrics.totalTrades,
          sharpeRatio: result.metrics.sharpeRatio,
        });

        successfulTests++;

        // Print quick summary
        const returnColor = result.metrics.totalReturn > 0 ? '✅' : '❌';
        console.log(`    ${returnColor} Win Rate: ${result.metrics.winRate.toFixed(1)}% | Return: $${result.metrics.totalReturn.toFixed(0)} | Trades: ${result.metrics.totalTrades}`);

      } catch (error: any) {
        failedTests++;
        console.log(`    ❌ FAILED: ${error.message}`);
      }
    }
  }

  // Print comprehensive results
  console.log('\n' + '='.repeat(80));
  console.log('📊 BACKTEST RESULTS SUMMARY');
  console.log('='.repeat(80));
  console.log();

  console.log(`Total Tests: ${totalTests}`);
  console.log(`Successful: ${successfulTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log();

  // Best strategies overall
  console.log('\n🏆 TOP 5 STRATEGIES BY WIN RATE:\n');
  const byWinRate = [...results].sort((a, b) => b.winRate - a.winRate).slice(0, 5);
  byWinRate.forEach((r, i) => {
    console.log(`${i + 1}. ${r.strategy} (${r.token})`);
    console.log(`   Win Rate: ${r.winRate.toFixed(1)}% | Return: $${r.totalReturn.toFixed(0)} | PF: ${r.profitFactor.toFixed(2)}`);
  });

  // Best strategies by profit
  console.log('\n💰 TOP 5 STRATEGIES BY TOTAL RETURN:\n');
  const byReturn = [...results].sort((a, b) => b.totalReturn - a.totalReturn).slice(0, 5);
  byReturn.forEach((r, i) => {
    console.log(`${i + 1}. ${r.strategy} (${r.token})`);
    console.log(`   Return: $${r.totalReturn.toFixed(0)} | Win Rate: ${r.winRate.toFixed(1)}% | Trades: ${r.totalTrades}`);
  });

  // Best by token
  console.log('\n📈 BEST STRATEGY PER TOKEN:\n');
  for (const token of TOKENS) {
    const tokenResults = results.filter(r => r.token === token.symbol);
    if (tokenResults.length === 0) continue;
    
    const best = tokenResults.reduce((a, b) => b.winRate > a.winRate ? b : a);
    console.log(`${token.symbol}: ${best.strategy}`);
    console.log(`  Win Rate: ${best.winRate.toFixed(1)}% | Return: $${best.totalReturn.toFixed(0)} | PF: ${best.profitFactor.toFixed(2)}`);
  }

  // Strategy averages
  console.log('\n📊 STRATEGY PERFORMANCE AVERAGES:\n');
  const strategyAverages = new Map<string, { winRates: number[], returns: number[], count: number }>();
  
  results.forEach(r => {
    if (!strategyAverages.has(r.strategy)) {
      strategyAverages.set(r.strategy, { winRates: [], returns: [], count: 0 });
    }
    const stats = strategyAverages.get(r.strategy)!;
    stats.winRates.push(r.winRate);
    stats.returns.push(r.totalReturn);
    stats.count++;
  });

  const avgResults = Array.from(strategyAverages.entries())
    .map(([name, stats]) => ({
      name,
      avgWinRate: stats.winRates.reduce((a, b) => a + b, 0) / stats.count,
      avgReturn: stats.returns.reduce((a, b) => a + b, 0) / stats.count,
      count: stats.count,
    }))
    .sort((a, b) => b.avgWinRate - a.avgWinRate);

  avgResults.forEach(s => {
    console.log(`${s.name}`);
    console.log(`  Avg Win Rate: ${s.avgWinRate.toFixed(1)}% | Avg Return: $${s.avgReturn.toFixed(0)} | Tests: ${s.count}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('✅ Backtesting complete! Results saved to database.');
  console.log('='.repeat(80));
}

// Run it
runComprehensiveBacktests().catch(console.error);
