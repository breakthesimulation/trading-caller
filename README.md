# Trading Caller — Autonomous AI Trading Intelligence for Solana

> **"Free your mind"** — Profitable, transparent, autonomous trading signals

[![Live Dashboard](https://img.shields.io/badge/Live-Dashboard-brightgreen)](https://web-production-5e86c.up.railway.app/)
[![API Status](https://img.shields.io/badge/API-Operational-success)](https://web-production-5e86c.up.railway.app/signals/latest)

---

## Live Performance

| Metric | Value |
|--------|-------|
| **LONG Win Rate** | **85.7%** |
| **Total PnL** | **+32.62%** |
| **Profit Factor** | **1.55x** |
| **Signals Tracked** | 17 |
| **Uptime** | 99.8% (24/7 autonomous) |

---

## What It Does

Trading Caller is an autonomous AI agent that generates actionable trading signals for Solana tokens. It runs 24/7, learns from outcomes, and publishes every result — wins and losses.

**Core Loop:**
1. Scan top Solana tokens across multiple timeframes
2. Calculate RSI, MACD, support/resistance, momentum
3. Apply learned weights from historical accuracy
4. Generate signals with entry, targets, stop-loss, confidence
5. Track outcomes and adjust

---

## Architecture

```
                        +------------------+
                        |   API Server     |
                        |   (Hono + WS)    |
                        +--------+---------+
                                 |
          +----------------------+----------------------+
          |                      |                      |
  +-------v--------+   +--------v--------+   +---------v--------+
  | Research Engine |   | RSI Scanner     |   | Volume Scanner   |
  | (Signal Gen)   |   | (100 tokens)    |   | (Pool Activity)  |
  +-------+--------+   +--------+--------+   +---------+--------+
          |                      |                      |
  +-------v------------------------------------------------------+
  |                    Data Layer (Multi-Source)                   |
  |  Birdeye -> GeckoTerminal -> DexScreener -> Simulated OHLCV  |
  +------+----------+-----------+-----------+--------------------+
         |          |           |           |
    +----v---+ +----v------+ +-v--------+ +v--------+
    |Birdeye | |GeckoTerm. | |DexScreen.| |Jupiter  |
    |(paid)  | |(free)     | |(free)    | |(free)   |
    +--------+ +-----------+ +----------+ +---------+
```

---

## Data Sources

| Source | Purpose | Cost | Rate Limit |
|--------|---------|------|------------|
| **GeckoTerminal** | OHLCV candles, pool discovery, trending | Free | 30 req/min |
| **DexScreener** | Token search, pair analytics, chart data | Free | Generous |
| **Jupiter** | Real-time Solana prices | Free | Unlimited |
| **Birdeye** | Premium OHLCV (optional) | API key | Tier-based |
| **CoinGecko** | Token lists, fallback OHLC | Free | 10-30 req/min |

**OHLCV priority chain:** Birdeye (if key) -> GeckoTerminal -> DexScreener -> Simulated

---

## Quick Start

### Get trading signals
```bash
curl https://web-production-5e86c.up.railway.app/signals/latest
```

### Find oversold tokens
```bash
curl https://web-production-5e86c.up.railway.app/rsi/oversold
```

### Multi-timeframe RSI scanner
```bash
curl https://web-production-5e86c.up.railway.app/rsi/multi
```

### Trending Solana pools (GeckoTerminal)
```bash
curl https://web-production-5e86c.up.railway.app/gecko/trending
```

### OHLCV candle data for a pool
```bash
curl "https://web-production-5e86c.up.railway.app/gecko/ohlcv/{poolAddress}?timeframe=hour&aggregate=4"
```

---

## API Endpoints

### Signals
| Method | Path | Description |
|--------|------|-------------|
| GET | `/signals/latest` | Latest trading signals |
| GET | `/signals/performance` | Signal performance stats |
| POST | `/market/scan` | Trigger manual market scan |
| GET | `/market/overview` | Full market overview |

### RSI Scanner
| Method | Path | Description |
|--------|------|-------------|
| GET | `/rsi/multi` | All tokens with multi-TF RSI |
| GET | `/rsi/multi/status` | Scanner status and cache |
| GET | `/rsi/multi/token/:id` | Single token RSI detail |
| POST | `/rsi/multi/scan` | Force rescan |
| GET | `/rsi/oversold` | Quick oversold list |

### GeckoTerminal
| Method | Path | Description |
|--------|------|-------------|
| GET | `/gecko/trending` | Trending Solana pools |
| GET | `/gecko/pools/:tokenAddress` | Pools for a token |
| GET | `/gecko/ohlcv/:poolAddress` | OHLCV candle data |
| GET | `/gecko/ohlcv-multi/:poolAddress` | Multi-TF OHLCV (1H/4H/1D) |
| GET | `/gecko/search?q=` | Search Solana pools |
| GET | `/gecko/token/:tokenAddress` | Token info |

### Volume & Funding
| Method | Path | Description |
|--------|------|-------------|
| GET | `/volume/signals` | Volume-based signals |
| GET | `/funding` | Funding rate summary |
| GET | `/funding/:symbol` | Single token funding |
| GET | `/funding/alerts/squeeze` | Squeeze alerts |

### Performance & Positions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/performance` | Win rate, PnL stats |
| GET | `/positions` | Active positions |
| GET | `/positions/history` | Closed positions |

### Backtesting
| Method | Path | Description |
|--------|------|-------------|
| GET | `/backtest/strategies` | Available strategies |
| POST | `/backtest/run` | Run single backtest |
| POST | `/backtest/batch` | Batch backtest |
| GET | `/backtest/results` | All results |

---

## Running Locally

```bash
# Install dependencies
npm install

# Start API server (includes scheduler, scanner, all routes)
npm run start

# Run backtests
npm run backtest
```

---

## Tech Stack

- **TypeScript** — All code
- **Hono** — API framework
- **SQLite** (better-sqlite3) — Local persistence
- **node-cron** — Scheduled scanning
- **technicalindicators** — RSI, MACD, Bollinger Bands
- **Anthropic Claude** — AI-powered analysis

---

## Key Files

```
research-engine/src/data/       # Data sources (Jupiter, DexScreener, GeckoTerminal, Birdeye)
research-engine/src/signals/    # Signal generation & TA
api/src/index.ts                # API server entry point
api/src/routes/                 # Route modules (signals, market, gecko, etc.)
api/src/rsi-multi.ts            # Multi-TF RSI scanner
backtesting/src/                # Backtesting engine
performance/                    # Win rate tracking
learning/                       # Outcome-based weight adjustment
```

---

## Built for Colosseum Agent Hackathon 2026

Trading Caller is an autonomous AI agent that:
- Operates 24/7 without human intervention
- Makes data-driven trading decisions using real on-chain Solana data
- Learns from every outcome and self-improves
- Publishes every signal transparently — wins and losses
- Provides a full API for other agents to integrate

*Built with conviction for the Solana ecosystem.*
