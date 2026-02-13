<p align="center">
  <img src="website/public/agent-fox-mascot.jpeg" width="140" alt="Agent Fox" style="border-radius: 16px" />
</p>

<h1 align="center">Agent Fox</h1>

<p align="center">
  <strong>AI-powered trading intelligence for Solana</strong><br />
  Scans the market. Surfaces signals. Tracks every outcome.
</p>

<p align="center">
  <a href="https://www.agentfox.trade"><img src="https://img.shields.io/badge/Live_App-agentfox.trade-blue?style=flat-square" alt="Live App" /></a>
  <a href="https://trading-caller-production-d7d3.up.railway.app/"><img src="https://img.shields.io/badge/API-Operational-brightgreen?style=flat-square" alt="API Status" /></a>
  <a href="https://x.com/AgentAIFox"><img src="https://img.shields.io/badge/Follow-@AgentAIFox-black?style=flat-square&logo=x" alt="Twitter" /></a>
</p>

---

## What is Agent Fox?

Agent Fox is an autonomous trading companion that monitors 100+ Solana tokens around the clock. It calculates technical indicators, generates actionable buy/sell signals, and tracks every prediction against real market outcomes — wins and losses, fully transparent.

No cherry-picked results. No black-box strategies. Just data.

**Live at [agentfox.trade](https://www.agentfox.trade)**

---

## Features

### Signal Generation
Generates LONG signals with precise entry, three take-profit targets, and stop-loss levels. Each signal includes a confidence score based on indicator confluence and historical accuracy.

### RSI Scanner
Scans top 100 Solana tokens across 1H, 4H, and 1D timeframes. Surfaces oversold bounces and overbought reversals with multi-timeframe alignment scoring.

### Volume Scanner
Detects volume spikes (2x+ above baseline) in real time. Classifies each spike as bullish, bearish, or neutral with severity ranking and optional Telegram alerts.

### Backtesting Engine
Eight trading strategies tested against historical OHLCV data. Reports win rate, profit factor, Sharpe ratio, and max drawdown for each.

### Performance Tracking
Every signal is scored against real market outcomes at 24h, 48h, and 7d intervals. Dashboard displays win rate, PnL, and profit factor — updated continuously.

### Autonomous Agent (ElizaOS)
Built on ElizaOS v1.7.2. Engages with the Colosseum hackathon forum, posts market updates, and reasons about trades using Claude AI.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Website (Next.js 15)                  │
│              www.agentfox.trade  ·  Vercel              │
└──────────────────────┬──────────────────────────────────┘
                       │ /api proxy
┌──────────────────────▼──────────────────────────────────┐
│                   API Server (Hono)                      │
│              Railway  ·  Cron Scheduler                  │
├─────────┬──────────┬──────────┬──────────┬──────────────┤
│ Signals │ RSI Scan │ Volume   │ Backtest │ Performance  │
│ Engine  │ (100 tkn)│ Scanner  │ Engine   │ Tracker      │
└────┬────┴────┬─────┴────┬────┴──────────┴──────────────┘
     │         │          │
┌────▼─────────▼──────────▼──────────────────────────────┐
│               Data Layer (Multi-Source)                  │
│  Jupiter  ·  DexScreener  ·  GeckoTerminal  ·  Birdeye │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **API** | TypeScript, Hono, node-cron |
| **Frontend** | Next.js 15, React 19, Tailwind, Shadcn UI |
| **Agent** | ElizaOS v1.7.2, Anthropic Claude |
| **Data** | Jupiter, DexScreener, GeckoTerminal, Birdeye |
| **Indicators** | RSI, MACD (3,10,16), EMA, Support/Resistance, Fibonacci, Volume |
| **Storage** | better-sqlite3, JSON persistence |
| **Deploy** | Railway (API + Agent), Vercel (Website), Docker |

---

## API

Base URL: `https://trading-caller-production-d7d3.up.railway.app`

### Signals
```
GET  /signals/latest          Latest trading signals
GET  /signals/performance     Win rate, PnL, profit factor
GET  /signals/tracked         Currently tracked signals
```

### RSI Scanner
```
GET  /rsi/multi               All tokens, all timeframes
GET  /rsi/oversold            Tokens with RSI ≤ 20
GET  /rsi/overbought          Tokens with RSI ≥ 80
GET  /rsi/:symbol             Single token across 1H/4H/1D
```

### Volume
```
GET  /volume/signals          Volume-based trading signals
GET  /volume/spikes           Recent spike history
GET  /volume/top              Top 10 volume movers
```

### Backtesting
```
GET  /backtest/strategies     Available strategies
GET  /backtest/results        Historical results
POST /backtest/run            Run a backtest
```

### Market Data
```
GET  /funding/:symbol         Funding rates + squeeze alerts
GET  /gecko/trending          Trending Solana pools
GET  /leaderboard/tokens      Token performance ranking
```

<details>
<summary><strong>Full endpoint reference</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/signals/latest` | Latest signals with optional action filter |
| `GET` | `/signals/history` | Paginated signal history |
| `GET` | `/signals/performance` | Performance metrics |
| `GET` | `/signals/tracked` | Active tracked signals |
| `POST` | `/signals/reset` | Reset signal history |
| `GET` | `/tokens/:symbol/analysis` | Deep single-token analysis |
| `GET` | `/rsi/multi` | Multi-timeframe RSI for all tokens |
| `GET` | `/rsi/scan` | Latest scan results |
| `GET` | `/rsi/oversold` | Oversold opportunities |
| `GET` | `/rsi/overbought` | Overbought setups |
| `GET` | `/rsi/:symbol` | Single token RSI |
| `POST` | `/rsi/multi/scan` | Force rescan |
| `GET` | `/volume/status` | Scanner status |
| `GET` | `/volume/top` | Top volume movers |
| `GET` | `/volume/spikes` | Spike history |
| `GET` | `/volume/signals` | Volume signals |
| `POST` | `/volume/scan` | Trigger manual scan |
| `GET` | `/funding/:symbol` | Funding rate analysis |
| `GET` | `/funding/alerts/squeeze` | Squeeze alert list |
| `GET` | `/backtest/strategies` | Strategy list |
| `GET` | `/backtest/results` | All backtest results |
| `POST` | `/backtest/run` | Execute backtest |
| `GET` | `/performance` | Overall performance |
| `GET` | `/positions/open` | Active positions |
| `GET` | `/positions/closed` | Closed positions |
| `GET` | `/positions/stats` | Position statistics |
| `GET` | `/leaderboard` | Overall leaderboard |
| `GET` | `/leaderboard/tokens` | Token rankings |
| `GET` | `/learning/stats` | Learning statistics |
| `GET` | `/learning/insights` | AI improvement insights |
| `GET` | `/learning/weights` | Current learned weights |
| `GET` | `/gecko/trending` | Trending Solana pools |
| `GET` | `/gecko/ohlcv/:pool` | OHLCV candle data |
| `GET` | `/gecko/search?q=` | Search Solana pools |

</details>

---

## Quick Start

```bash
# Clone
git clone https://github.com/breakthesimulation/trading-caller.git
cd trading-caller

# Install
npm install

# Configure
cp .env.example .env
# Add your API keys to .env

# Run API server (includes scheduler)
npm start

# Run website locally
cd website && npm install && npm run dev
```

### Environment Variables

```env
ANTHROPIC_API_KEY=       # Claude AI (signal reasoning)
TELEGRAM_BOT_TOKEN=      # Telegram alerts (optional)
TELEGRAM_CHAT_ID=        # Telegram target chat (optional)
PORT=3000                # API server port
```

---

## Project Structure

```
├── api/                 API server (Hono routes, scheduler, WebSocket)
├── research-engine/     Signal generation, technical indicators, data providers
├── volume-scanner/      Real-time volume spike detection
├── oversold/            RSI-based oversold/overbought scanner
├── backtesting/         Historical strategy validation engine
├── performance/         Signal outcome tracking and scoring
├── learning/            Pattern analysis and weight adjustment
├── agent/               Colosseum hackathon agent (heartbeat, forum, brain)
├── eliza/               ElizaOS autonomous trading agent
├── website/             Next.js frontend (Vercel)
├── db/                  Data persistence layer
├── scripts/             Utility and registration scripts
└── data/                Runtime data storage
```

---

## How Signals Work

1. **Scan** — Continuously monitors 100+ Solana tokens for technical setups
2. **Analyze** — Calculates RSI, MACD, EMA, support/resistance, volume, and funding rates
3. **Weight** — Applies learned weights from historical signal accuracy
4. **Score** — Rates confidence based on indicator confluence
5. **Signal** — Publishes actionable call with entry, three targets, and stop-loss
6. **Track** — Monitors outcomes at 24h, 48h, and 7d and updates performance metrics

---

## Links

| | |
|---|---|
| **Website** | [agentfox.trade](https://www.agentfox.trade) |
| **API** | [trading-caller-production-d7d3.up.railway.app](https://trading-caller-production-d7d3.up.railway.app/) |
| **Twitter/X** | [@AgentAIFox](https://x.com/AgentAIFox) |
| **Pitch Deck** | [View on Google Drive](https://drive.google.com/file/d/1h9zRlxVLxYwkfrepG61IlC4EP1He30eR/view?usp=sharing) |

---

<p align="center">
  Built for the <a href="https://www.colosseum.org/">Colosseum</a> Agent Hackathon 2026<br />
  <em>"Free your mind."</em>
</p>
