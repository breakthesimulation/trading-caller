# Trading Caller — Architecture

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Dashboard │    │   REST API      │    │   Agent Brain   │
│   (Frontend)    │◄──►│   (Hono)        │◄──►│   (Claude AI)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Core Engine Layer                          │
├─────────────────┬─────────────────┬─────────────────┬──────────┤
│  Signal Engine  │ Volume Scanner  │  RSI Scanner    │Backtesting│
│  (research)     │ (real-time)     │ (oversold/buy)  │(historical)│
└─────────────────┴─────────────────┴─────────────────┴──────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Data & Storage Layer                        │
├─────────────────┬─────────────────┬─────────────────┬──────────┤
│   SQLite DB     │   File System   │   Memory Cache  │External  │
│   (signals,     │   (logs, state) │   (performance) │APIs      │
│   outcomes)     │                 │                 │(prices)  │
└─────────────────┴─────────────────┴─────────────────┴──────────┘
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js v22 + TypeScript |
| API | Hono |
| Database | SQLite (better-sqlite3) |
| Scheduling | node-cron |
| AI | Anthropic Claude API |
| Price Data | DexScreener, Jupiter, Birdeye, CoinGecko |
| Alerts | Telegram Bot API |
| Hosting | Railway |

## Core Components

### Research Engine (`research-engine/src/`)
Signal generation and technical analysis. Calculates RSI, MACD, EMAs, support/resistance across 1H/4H/1D timeframes. Outputs confidence-scored trading signals.

### Volume Scanner (`volume-scanner/`)
Real-time volume spike detection. Monitors 20+ tokens every 5 minutes, detects 2x+ spikes, classifies as Bullish/Bearish/Neutral, sends Telegram alerts with 1-hour cooldown.

### RSI Scanner (`oversold/`)
Oversold/overbought opportunity detection. Identifies extreme RSI levels (≤20, ≥80) with multi-timeframe alignment.

### Backtesting Engine (`backtesting/`)
Historical strategy validation. 8 strategies (RSI variants, MACD crossover, combined). Stores results in SQLite with win rate, profit factor, Sharpe ratio.

### Learning System (`learning/`)
Outcome tracking (24h/48h/7d windows) and strategy weight adjustment. Identifies successful patterns and calibrates confidence scores.

### Agent Brain (`agent/`)
Hackathon integration: Colosseum API, forum engagement, heartbeat sync, Claude AI reasoning.

### API Layer (`api/src/`)
Hono REST server exposing all functionality. Endpoint categories: signals, market, scanners, backtesting, agent status.

## Data Models

### Trading Signal
```typescript
interface TradingSignal {
  id: string;
  timestamp: string;
  token: { symbol: string; name: string; address: string; decimals: number };
  action: "LONG" | "SHORT";
  entry: number;
  targets: number[];
  stopLoss: number;
  confidence: number;       // 0-100
  timeframe: "1H" | "4H" | "1D";
  reasoning: { technical: string; fundamental: string; sentiment: string };
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  technicalAnalysis: {
    rsi: { value: number; signal: string };
    macd: { macd: number; signal: number; histogram: number; trend: string };
    trend: { direction: string; strength: number };
    support: number[];
    resistance: number[];
    momentum: { value: number; increasing: boolean };
  };
}
```

### Volume Spike
```typescript
interface VolumeSpike {
  timestamp: string;
  token: { symbol: string; address: string };
  volume: { current1h: number; avgHourly: number; spike: number; change: number };
  price: { current: number; change1h: number; change24h: number };
  transactions: { buys: number; sells: number; ratio: number; velocity: number };
  classification: "BULLISH" | "BEARISH" | "NEUTRAL";
  severity: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
}
```

## Database Schema

```sql
CREATE TABLE signals (
  id TEXT PRIMARY KEY,
  timestamp TEXT,
  symbol TEXT,
  action TEXT,
  entry REAL,
  targets TEXT,           -- JSON array
  stopLoss REAL,
  confidence INTEGER,
  timeframe TEXT,
  reasoning TEXT,         -- JSON object
  riskLevel TEXT,
  technicalAnalysis TEXT, -- JSON object
  indicators TEXT,        -- JSON object
  outcome TEXT,
  pnl REAL,
  resolved_at TEXT
);

CREATE TABLE backtest_results (
  id TEXT PRIMARY KEY,
  symbol TEXT,
  strategy_name TEXT,
  timeframe TEXT,
  total_trades INTEGER,
  win_rate REAL,
  total_return REAL,
  profit_factor REAL,
  sharpe_ratio REAL,
  max_drawdown REAL,
  results_json TEXT,
  created_at TEXT
);
```

## Data Flow

### Signal Generation
```
Market Data → Technical Analysis → Multi-Timeframe Confirmation → AI Reasoning → Confidence Scoring → Storage → API
```

### Learning Loop
```
Signal Outcomes → Performance Analysis → Weight Adjustment → Improved Signals
```

## Scheduled Tasks

| Task | Cron | Description |
|------|------|-------------|
| Heartbeat | `*/30 * * * *` | Sync hackathon, check replies |
| Market Scan | `0 * * * *` | Generate signals |
| Forum | `0 */2 * * *` | Post updates, engage |
| Outcomes | `0 */4 * * *` | Check signal results |
| Learning | `0 */6 * * *` | Analyze patterns |

## Directory Structure

```
trading-caller/
├── agent/              # Hackathon agent (brain, forum, heartbeat, scheduler)
├── api/src/            # Hono REST API
├── backtesting/src/    # Strategy backtesting engine
├── db/                 # SQLite databases
├── learning/           # Outcome tracking + weight adjustment
├── oversold/           # RSI scanner
├── research-engine/src/# Signal generation + technical analysis
├── scoring/src/        # Performance tracking + leaderboard
├── volume-scanner/     # Volume spike detection + Telegram alerts
├── website/            # Frontend dashboard
├── scripts/            # CLI utilities
└── programs/           # Solana on-chain (future)
```
