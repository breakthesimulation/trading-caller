# Backtesting Results

## Overview

The Trading Caller backtesting system tests 8 different trading strategies across multiple tokens and timeframes to determine which approaches yield the best results.

**Data source:** OHLCV candles from GeckoTerminal (primary) and DexScreener (fallback), providing real on-chain Solana pool data.

## Test Parameters

- **Test Period:** Last 90 days of market data
- **Initial Capital:** $10,000 per test
- **Position Size:** 10% of capital per trade
- **Timeframes Tested:** 1H, 4H, 1D
- **Tokens Tested:** SOL, ETH, BTC, JUP, WIF, BONK, HYPE
- **OHLCV Source:** GeckoTerminal API (free, 30 req/min)

## Strategies Tested

### 1. RSI Oversold Long
**Strategy:** Buy when RSI < 30, sell when RSI > 70
- **Stop Loss:** 5%
- **Take Profit:** 10%
- **Expected Use Case:** Mean reversion plays in ranging markets

### 2. RSI Extreme Oversold
**Strategy:** Buy when RSI < 25 (more extreme)
- **Stop Loss:** 7%
- **Take Profit:** 15%
- **Expected Use Case:** Catching major bounces after sell-offs

### 3. RSI Overbought Short
**Strategy:** Short when RSI > 70, cover when RSI < 30
- **Stop Loss:** 5%
- **Take Profit:** 10%
- **Expected Use Case:** Fading overbought rallies

### 4. RSI + Trend Alignment
**Strategy:** Only buy oversold RSI when overall trend is bullish
- **Stop Loss:** 4%
- **Take Profit:** 12%
- **Expected Use Case:** Higher probability setups aligned with trend

### 5. MACD Crossover
**Strategy:** Buy on bullish MACD cross, sell on bearish cross
- **Stop Loss:** 6%
- **Take Profit:** 12%
- **Expected Use Case:** Momentum-based trend following

### 6. RSI + MACD Combined
**Strategy:** Require both RSI oversold AND MACD bullish
- **Stop Loss:** 5%
- **Take Profit:** 15%
- **Expected Use Case:** High-conviction multi-indicator confirmation

### 7. Conservative RSI
**Strategy:** Tight stops (3%) and modest targets (6%)
- **Expected Win Rate:** Higher
- **Expected Use Case:** Lower risk, frequent small wins

### 8. Aggressive RSI
**Strategy:** Wide stops (8%) and large targets (20%)
- **Expected Win Rate:** Lower
- **Expected Use Case:** Let winners run, accept lower win rate

## Initial Hypotheses

Before running the backtests, here are our expectations:

### By Strategy Type
1. **Trend-aligned strategies** should outperform counter-trend
2. **Conservative strategies** should have higher win rates but lower total returns
3. **Combined indicator strategies** should have fewer but higher quality signals

### By Token
1. **BTC/ETH** likely more predictable due to higher liquidity
2. **SOL** should show strong performance in uptrends
3. **Smaller caps** (WIF, BONK) may have higher volatility = better RSI signals

### By Timeframe
1. **4H** expected to be sweet spot (less noise than 1H, faster than 1D)
2. **1H** may have more whipsaws and false signals
3. **1D** should produce fewer but higher quality signals

## Preliminary Findings

**Live system results (17 signals tracked):**
- Overall win rate: 35.3%
- LONG win rate: 85.7%
- Total PnL: +32.62%
- Profit factor: 1.55x

*Full backtest suite results pending. Run `npm run backtest` to generate.*

### Key Metrics to Track
- **Win Rate:** % of profitable trades
- **Profit Factor:** Total wins / Total losses
- **Sharpe Ratio:** Risk-adjusted returns
- **Max Drawdown:** Largest peak-to-trough decline
- **Average Trade Duration:** How long positions are held
- **Risk/Reward Ratio:** Average win vs average loss

## Running Your Own Backtests

### Via API

```bash
# Run a single backtest
curl -X POST http://localhost:3000/backtest/run \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "SOL",
    "address": "So11111111111111111111111111111111111111112",
    "strategyName": "RSI Oversold Long",
    "timeframe": "4H"
  }'

# Run batch backtests (multiple strategies × symbols)
curl -X POST http://localhost:3000/backtest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": [
      {"symbol": "SOL", "address": "So11111111111111111111111111111111111111112"},
      {"symbol": "BTC", "address": "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh"}
    ],
    "strategies": ["RSI Oversold Long", "RSI + Trend Alignment"],
    "timeframe": "4H"
  }'

# View results
curl http://localhost:3000/backtest/results

# Get best strategies
curl http://localhost:3000/backtest/analysis/strategies
```

### Via Script

```bash
# Run comprehensive backtests on all strategies
npm run backtest

# Or run manually
tsx scripts/run-backtests.ts
```

## Analysis & Insights

### Question: What RSI levels are most profitable?

**Method:** Compare win rates across different RSI thresholds (20, 25, 30, 35)

**Expected Answer:**
- Extreme levels (<25) may have higher win rate but fewer signals
- Moderate levels (30-35) may balance signal frequency with quality

### Question: Does trend alignment improve results?

**Method:** Compare "RSI Oversold Long" vs "RSI + Trend Alignment"

**Expected Answer:**
- Trend-aligned should have higher win rate
- May have fewer total signals but better quality

### Question: Which timeframes work best?

**Method:** Run same strategy across 1H, 4H, 1D timeframes

**Expected Answer:**
- 4H likely optimal balance
- 1H may have too much noise
- 1D may miss entries but have cleaner signals

### Question: How do stop-loss levels affect profitability?

**Method:** Compare "Conservative" (3% stop) vs "Aggressive" (8% stop)

**Expected Answer:**
- Tighter stops = higher win rate, lower profit factor
- Wider stops = lower win rate, potentially higher profit factor
- Optimal balance depends on token volatility

## Database Schema

All backtest results are stored in SQLite:

```sql
CREATE TABLE backtest_results (
  id TEXT PRIMARY KEY,
  strategy_name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  win_rate REAL NOT NULL,
  total_return REAL NOT NULL,
  profit_factor REAL NOT NULL,
  total_trades INTEGER NOT NULL,
  sharpe_ratio REAL,
  max_drawdown REAL,
  result TEXT NOT NULL,  -- Full JSON result
  created_at TEXT NOT NULL
);
```

## Next Steps

1. ✅ **System built** - Backtesting engine complete
2. 🔄 **Run comprehensive tests** - All strategies × all tokens
3. 📊 **Analyze results** - Determine winning patterns
4. 🎯 **Integrate winners** - Update signal generation with best strategies
5. 📈 **Live tracking** - Compare backtest vs real performance

## API Endpoints

```
GET  /backtest/strategies           List all available strategies
POST /backtest/run                  Run a single backtest
POST /backtest/batch                Run multiple backtests
GET  /backtest/results              View all backtest results
GET  /backtest/results/:id          Get specific backtest details
GET  /backtest/analysis/strategies  Best performing strategies
GET  /backtest/analysis/symbols/:symbol  Stats for specific token
GET  /backtest/health               System status
```

## Contributing

Found a profitable strategy? Submit a PR with:
1. Strategy definition in `backtesting/src/strategies.ts`
2. Backtest results showing profitability
3. Analysis of why it works

---

**Last Updated:** 2026-02-11
**Status:** System operational with GeckoTerminal OHLCV integration. Comprehensive backtests pending.
