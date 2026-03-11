# Signal Generation Strategy

## Overview

Trading Caller generates **trading signals (calls)** — not trades. It analyzes Solana token price data, runs technical analysis across multiple timeframes, and only produces a signal when **3 or more independent factors** agree on a direction. This confluence requirement is the core design principle.

The system is intentionally conservative. Most tokens get rejected. A low signal rate is a feature, not a bug.

## Architecture

```
Live Market Data (Jupiter, GeckoTerminal)
        │
        ▼
   OHLCV Candles (1H, 4H, 1D)
        │
        ▼
  Technical Analysis (RSI, MACD, Bollinger, Trend, S/R)
        │
        ▼
  Confluence Factor Counting (9 independent factors)
        │
        ▼
  Filters (min 3 factors, min 65% confidence, no volume divergence)
        │
        ▼
  ATR-Based Risk Levels (stop loss, targets at 1R / 1.5R / 2.5R)
        │
        ▼
  Signal Output (or rejection)
```

**Key files:**
- `research-engine/src/signals/generator.ts` — Signal generation logic
- `research-engine/src/signals/confidence.ts` — Confidence scoring
- `research-engine/src/technical/index.ts` — Technical analysis engine
- `research-engine/src/technical/volume.ts` — Volume analysis
- `research-engine/src/data/jupiter.ts` — Jupiter price feed
- `research-engine/src/data/geckoterminal.ts` — GeckoTerminal OHLCV data

## The 9 Confluence Factors

Each factor is an independent signal. Bullish and bearish factors are counted separately. The direction with the most factors wins.

| # | Factor | Bullish Condition | Bearish Condition |
|---|--------|-------------------|-------------------|
| 1 | **RSI extreme (4H)** | RSI <= 30 (oversold). RSI <= 20 counts as 2 factors | RSI >= 70 (overbought). RSI >= 80 counts as 2 factors |
| 2 | **RSI multi-timeframe** | 4H oversold AND 1D RSI < 40 | 4H overbought AND 1D RSI > 60 |
| 3 | **MACD crossover** | Bullish cross on 4H | Bearish cross on 4H |
| 4 | **MACD trend alignment** | 4H and 1D both bullish | 4H and 1D both bearish |
| 5 | **Trend direction** | 4H uptrend with >40% strength | 4H downtrend with >40% strength |
| 6 | **Trend multi-timeframe** | 4H and 1D both trending up | 4H and 1D both trending down |
| 7 | **Volume confirmation** | Volume >= 1.2x avg with price rising | Volume >= 1.2x avg with price falling |
| 8 | **Buy/sell pressure** | Jupiter on-chain data shows >60% buys | Jupiter on-chain data shows >60% sells |
| 9 | **Price at key level** | Price within 2% of support | Price within 2% of resistance |

## Filters That Reject Signals

A signal must pass every filter or it gets dropped:

| Filter | Threshold | Why |
|--------|-----------|-----|
| **Minimum confluence** | 3 factors | Single-indicator signals are unreliable on memecoins |
| **Minimum confidence** | 65% | Below this, historical performance is negative |
| **Volume divergence** | Any | Volume contradicting price direction = unreliable |
| **SHORT signals** | Always blocked | `SHORTS_ENABLED = false` — 0% historical win rate on crypto |
| **Stablecoins** | Always blocked | No point generating signals for pegged assets |
| **Insufficient data** | < 35 candles on 4H | Not enough data for reliable indicator calculation |

## Confidence Scoring

Confidence is **not** a percentage chance of winning. It's a quality score based on how many factors align and how strong they are.

```
Base confidence (from confluence count):
  5+ factors → 82
  4  factors → 73
  3  factors → 63

Adjustments:
  +5  Volume spike >= 2.0x average
  +2  Volume >= 1.2x average
  -5  Volume < 0.8x average (low volume)
  +3  Trend strength > 60%
  +4  4H and 1D trends aligned (same direction, not sideways)
  +3  On-chain buy/sell pressure confirms direction

Range: 25 to 95 (clamped)
```

## Risk Management

### Stop Loss (ATR-Based)
Stop loss is set using **Average True Range** — a volatility-adjusted distance:
- Calculate 14-period ATR on 4H candles using Wilder's smoothing
- Stop = entry - (ATR x 1.5) for LONG
- Also considers nearest support level — uses the **tighter** (closer) of the two

### Take Profit Targets
Targets are set as multiples of risk (R = entry - stop):
- **TP1**: 1.0R (1:1 risk:reward)
- **TP2**: 1.5R
- **TP3**: 2.5R

TP1 is capped at the nearest resistance level if that's closer.

### Risk Level Classification

| Risk Level | Condition |
|------------|-----------|
| **LOW** | Confidence >= 78 AND ATR < 5% of price |
| **HIGH** | Confidence < 65 OR ATR > 10% of price OR sideways trend |
| **MEDIUM** | Everything else |

## Test Scripts

### `scripts/test-signals.ts` — Offline Testing (No API Calls)

Generates synthetic OHLCV data to test the signal generator against known scenarios:

| Scenario | Mock Data | Expected Result |
|----------|-----------|-----------------|
| Oversold bounce | 80 candles down, then 20 up | LONG signal (RSI reversal) |
| Overbought pullback | 80 candles up, then 20 down | SHORT signal (blocked by kill switch) |
| Strong uptrend | 100 candles trending up | LONG signal (trend following) |
| Strong downtrend | 100 candles trending down | SHORT signal (blocked by kill switch) |
| Sideways consolidation | 100 low-volatility candles | No signal (insufficient confluence) |

Run with:
```bash
npm run signals
```

### `scripts/test-new-strategy.ts` — Live Data Testing

Fetches real OHLCV from Jupiter/GeckoTerminal for SOL, JUP, BONK, WIF. Runs the full confluence engine against actual market conditions.

- 15-second delay between tokens (GeckoTerminal rate limit: 30 req/min)
- Logs RSI, trend, MACD, confluence count, and signal details
- Intentionally low signal rate — most tokens will show "No signal"

Run with:
```bash
tsx scripts/test-new-strategy.ts
```

## Why the Old Strategy Failed

The previous RSI mean-reversion strategy was replaced because:

1. **Traded on fake data** — Simulated OHLCV candles when APIs returned insufficient data
2. **RSI mean-reversion doesn't work on memecoins** — They trend to zero, they don't revert
3. **No volume confirmation** — Bought into low-volume fakeouts
4. **No liquidity/market cap filters** — Generated signals for illiquid micro-caps
5. **Mock historical win rates** — Inflated confidence with fake performance data

The confluence-based strategy fixes all of these by requiring multiple real, independent confirmations before generating any signal.

## Data Flow

```
Jupiter Price API v3        → Current prices, buy/sell pressure
Jupiter Token API v2        → Token metadata, liquidity, market cap
GeckoTerminal OHLCV API    → Historical candles (1H, 4H, 1D)
        │
        ▼
Market Quality Filters:
  - Minimum $500K liquidity
  - Minimum $5M market cap
        │
        ▼
TradingCallerEngine.analyzeToken()
        │
        ▼
generateSignal() → TradingSignal | null
```

## Signal Output Format

When a signal passes all filters, it returns:

```typescript
{
  id: "sig_abc123",
  timestamp: "2026-03-11T12:00:00Z",
  token: { symbol: "SOL", name: "Solana", address: "So1111..." },
  action: "LONG",
  entry: 148.5000,
  targets: [155.0000, 162.0000, 170.0000],
  stopLoss: 142.0000,
  confidence: 78,
  timeframe: "4H",
  riskLevel: "MEDIUM",
  reasoning: {
    technical: "4 confluence factors: [Oversold RSI(4H)=28, MACD bullish crossover, ...]. Volume 1.8x avg.",
    fundamental: "No significant fundamental factors",
    sentiment: "Neutral market sentiment"
  },
  indicators: {
    rsi_4h: 28.3,
    rsi_1d: 38.1,
    trend_strength: 52.4,
    macd_histogram: 0.0023,
    volume_ratio: 1.8,
    confluence_count: 4,
    atr: 3.42
  }
}
```
