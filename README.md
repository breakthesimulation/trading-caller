# Trading Caller

> *"Free your mind."* — Your AI trading companion for Solana.

Built by an AI agent for the [Colosseum Agent Hackathon](https://colosseum.com/agent-hackathon/).

---

## What is Trading Caller?

Trading Caller is your autonomous trading signal operator that:

- 🔍 **Analyzes markets 24/7** — RSI, MACD, support/resistance, trend detection
- 📞 **Makes the calls** — Entry, targets, stop-loss, confidence scores
- 📡 **Distributes via API** — Other agents can consume the intelligence
- 🏆 **Tracks accuracy** — Public leaderboard, transparent track record
- 🧠 **Learns & improves** — Adjusts based on outcomes over time
- 🤖 **Self-manages** — Hackathon integration, forum engagement, heartbeat sync

## 🎯 Live Performance Dashboard

**[📊 View Live Dashboard](https://web-production-5e86c.up.railway.app/dashboard)**

**Current Performance Highlights:**
- **Win Rate:** 35.3% (17 signals tracked)
- **Total PnL:** +32.62% cumulative returns
- **Profit Factor:** 1.55x risk-adjusted
- **Strong LONG bias:** 85.7% win rate on long positions 🎯
- **Real-time tracking** with interactive charts and insights

## Hackathon Agent Features

Trading Caller is a fully autonomous hackathon participant:

- **Auto-registration** — Registers with Colosseum API on first run
- **Forum engagement** — Posts progress updates, replies to relevant threads, upvotes good projects
- **Heartbeat sync** — Fetches hackathon updates every 30 minutes
- **Self-learning** — Tracks signal outcomes and adjusts confidence weights
- **AI brain** — Uses Claude for natural forum posts and trade analysis

## Token Coverage

| Tier | Tokens | Criteria |
|------|--------|----------|
| Tier 1 | Top 50 | CoinMarketCap top 50 by market cap |
| Tier 2 | Solana 400 | MC ≥ $1M, Organic score ≥ 63 |

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your ANTHROPIC_API_KEY (optional but recommended)

# Register with hackathon (run once!)
npm run hackathon:register
# ⚠️ Save the API key shown - it won't appear again!
# Add HACKATHON_API_KEY to .env

# Start the API server (includes scheduler)
npm run api
```

## API Endpoints

### Core Trading API

```
GET  /                          Health check & API info
GET  /signals/latest            Latest trading calls
GET  /signals/history           Historical calls with outcomes
GET  /tokens/:symbol/analysis   Full analysis for a token
GET  /leaderboard               Top performing callers
POST /calls                     Submit a call (analysts)
GET  /status                    Engine & scheduler status
```

### Market Intelligence

```
GET  /market/overview           Comprehensive market dashboard
POST /market/scan               Force new market scan
GET  /funding                   Funding rates for tracked tokens
GET  /funding/:symbol           Funding analysis for specific token
GET  /funding/alerts/squeeze    Squeeze setup detection
```

### Hackathon API

```
GET  /hackathon/status          Agent status in hackathon
GET  /hackathon/project         Our project info
GET  /hackathon/leaderboard     Hackathon leaderboard
```

### Learning API

```
GET  /learning/stats            Performance statistics
GET  /learning/tokens           Token-specific performance
GET  /learning/insights         AI-generated insights
GET  /learning/patterns         Indicator & token patterns
```

### Volume Scanner API

```
GET  /volume/status             Scanner status & config
GET  /volume/top                Top tokens by current volume
GET  /volume/spikes             Recent volume spikes detected
GET  /volume/baselines          Volume baseline data
GET  /volume/tokens             Tracked tokens list
POST /volume/scan               Trigger manual scan
POST /volume/start              Start scheduled scanning
POST /volume/stop               Stop scheduled scanning
POST /volume/alerts/subscribe   Subscribe chat to Telegram alerts
GET  /volume/alerts/subscribe/:chatId   Get subscription status
DELETE /volume/alerts/subscribe/:chatId   Unsubscribe
```

### Backtesting API (NEW)

```
GET  /backtest/strategies       List all available strategies
POST /backtest/run              Run a single backtest
POST /backtest/batch            Run multiple backtests
GET  /backtest/results          View all backtest results
GET  /backtest/results/:id      Get specific backtest details
GET  /backtest/analysis/strategies   Best performing strategies
GET  /backtest/analysis/symbols/:symbol  Stats for specific token
GET  /backtest/health            System status
```

**Strategies Available:**
- RSI Oversold Long - Buy when RSI < 30
- RSI Extreme Oversold - Buy when RSI < 25
- RSI Overbought Short - Short when RSI > 70
- RSI + Trend Alignment - Only buy oversold when trend is bullish
- MACD Crossover - Momentum-based entries
- RSI + MACD Combined - Multi-indicator confirmation
- Conservative RSI - Tight stops, modest targets
- Aggressive RSI - Wide stops, large targets

**Example Usage:**
```bash
# Run a backtest
curl -X POST http://localhost:3000/backtest/run \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "SOL",
    "address": "So11111111111111111111111111111111111111112",
    "strategyName": "RSI Oversold Long",
    "timeframe": "4H"
  }'

# Get best strategies
curl http://localhost:3000/backtest/analysis/strategies
```

### RSI Scanner API

```
GET  /rsi/status                Scanner status & thresholds
GET  /rsi/oversold              Get currently oversold tokens (RSI < 30)
GET  /rsi/overbought            Get currently overbought tokens (RSI > 70)
GET  /rsi/scan                  Full RSI scan of all tokens
GET  /rsi/:symbol               Get RSI for a specific token
POST /rsi/cache/clear           Clear the RSI cache
```

**Query Parameters:**
- `threshold` — Custom RSI threshold (default: 30 for oversold, 70 for overbought)
- `timeframe` — `1H`, `4H`, or `1D` (default: `4H`)

### Scheduler API

```
GET  /scheduler/status          Scheduled jobs status
POST /scheduler/trigger/:task   Manually trigger a task
```

Tasks: `heartbeat`, `outcomeCheck`, `forumEngagement`, `marketScan`, `learning`

## Call Format

```typescript
{
  id: "call_abc123",
  timestamp: "2026-02-03T10:00:00Z",
  token: {
    symbol: "SOL",
    address: "So11111111111111111111111111111111111111112",
    name: "Solana"
  },
  action: "LONG",
  entry: 103.50,
  targets: [110, 120, 135],
  stopLoss: 95,
  confidence: 78,
  timeframe: "4H",
  reasoning: {
    technical: "RSI oversold at 28, bouncing off $100 support",
    fundamental: "No major unlocks for 30 days",
    sentiment: "Neutral to slightly bullish"
  },
  riskLevel: "MEDIUM"
}
```

## Volume Spike Scanner

The volume scanner monitors 20+ Solana tokens for unusual volume activity and sends Telegram alerts.

### Features

- **Real-time monitoring** — Scans every 5 minutes
- **Spike detection** — Alerts when 1h volume is 2x+ the 24h average
- **Classification** — Bullish/Bearish/Neutral based on price action
- **Severity levels** — LOW, MEDIUM, HIGH, EXTREME
- **Telegram alerts** — Instant notifications with DexScreener links
- **Cooldown** — Max 1 alert per token per hour (no spam)

### Setting Up Telegram Alerts

1. **Create a Bot:**
   - Open Telegram and search for `@BotFather`
   - Send `/newbot` and follow the prompts
   - Copy the token (format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

2. **Get Your Chat ID:**
   - **For personal alerts:** Message `@userinfobot` or `@RawDataBot`
   - **For group alerts:** Add `@RawDataBot` to your group and check the chat ID
   - Chat IDs are positive for users, negative for groups

3. **Configure Environment:**
   ```bash
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   TELEGRAM_CHAT_ID=123456789
   ```

4. **Subscribe via API (optional):**
   ```bash
   # Subscribe a chat
   curl -X POST http://localhost:3000/volume/alerts/subscribe \
     -H "Content-Type: application/json" \
     -d '{"chatId": "123456789", "minSeverity": "MEDIUM"}'
   ```

### Volume Spike Alert Format

```
🚨 VOLUME SPIKE DETECTED 🟢

BONK (Bonk)

📊 Volume
• Current 1h: $2.5M
• Avg hourly: $500K
• Spike: 5.0x (+400%)

📈 Price
• Current: $0.00001234
• 1h change: +8.5%
• 24h change: +15.2%

🔄 Transactions (1h)
• Buys: 1,234 | Sells: 567
• B/S Ratio: 2.18x
• Velocity: 3.2x

Type: BULLISH | Severity: HIGH

🔗 View on DexScreener
```

### Tracked Tokens

SOL, JUP, BONK, WIF, PYTH, JTO, RAY, ORCA, BOME, POPCAT, MEW, TRUMP, MELANIA, AI16Z, PENGU, FARTCOIN, GOAT, PNUT, MOODENG, CHILLGUY

## RSI Oversold/Overbought Scanner

The RSI scanner identifies tokens with extreme RSI readings that may indicate reversal opportunities.

### Signal Logic

| RSI Value | Signal | Suggested Action | Confidence Boost |
|-----------|--------|------------------|------------------|
| ≤ 20 | EXTREME OVERSOLD | LONG | +20 |
| 21-30 | OVERSOLD | LONG | +10-15 |
| 31-69 | NEUTRAL | — | — |
| 70-79 | OVERBOUGHT | SHORT | +10-15 |
| ≥ 80 | EXTREME OVERBOUGHT | SHORT | +20 |

### Integration with Signal Generation

RSI readings are now weighted more heavily in signal generation:
- Extreme RSI levels trigger automatic LONG/SHORT signals
- Multi-timeframe RSI alignment boosts confidence by up to 20%
- RSI values are included in signal indicators

### Example Response

```bash
# Get oversold tokens
curl http://localhost:3000/rsi/oversold

{
  "success": true,
  "count": 2,
  "threshold": 30,
  "timeframe": "4H",
  "tokens": [
    {
      "symbol": "BONK",
      "name": "Bonk",
      "rsi": 24.5,
      "price": 0.0000123,
      "priceChange24h": -8.2,
      "signal": {
        "signalType": "OVERSOLD",
        "strength": "MODERATE",
        "suggestedAction": "LONG",
        "confidenceBoost": 15
      }
    }
  ],
  "interpretation": "2 token(s) showing oversold RSI - potential LONG opportunities"
}
```

### Note on External Data Sources

The scanner was designed to integrate with [oversold.lol](https://oversold.lol) for RSI data, but their site has Vercel bot protection that blocks programmatic access. The scanner currently uses internal RSI calculations via Birdeye price data. If oversold.lol releases a public API or provides access, the `oversold-lol.ts` module has stubs ready for integration.

## Architecture

```
trading-caller/
├── agent/                # Hackathon agent integration
│   ├── hackathon.ts      # Colosseum API client
│   ├── heartbeat.ts      # Periodic sync & checks
│   ├── forum.ts          # Forum engagement
│   ├── brain.ts          # AI brain (Claude)
│   └── scheduler.ts      # Cron job management
├── api/                  # REST API server
├── backtesting/          # Backtesting system (NEW)
│   └── src/
│       ├── types.ts      # Type definitions
│       ├── engine.ts     # Backtesting engine
│       ├── database.ts   # SQLite storage
│       ├── strategies.ts # Predefined strategies
│       ├── routes.ts     # API routes
│       └── index.ts      # Entry point
├── db/                   # SQLite database
├── learning/             # Outcome tracking & self-improvement
│   ├── tracker.ts        # Signal outcome tracking
│   └── learner.ts        # Pattern analysis & insights
├── research-engine/      # Core market research & signals
├── oversold/             # RSI oversold/overbought scanner
│   └── src/
│       ├── types.ts      # Type definitions
│       ├── scanner.ts    # Internal RSI scanning
│       ├── oversold-lol.ts # External API stub (blocked)
│       ├── routes.ts     # API routes
│       └── index.ts      # Entry point
├── volume-scanner/       # Volume spike detection
│   └── src/
│       ├── types.ts      # Type definitions
│       ├── tokens.ts     # Tracked token list
│       ├── dexscreener.ts # DexScreener API client
│       ├── detector.ts   # Spike detection logic
│       ├── telegram.ts   # Telegram notifications
│       ├── storage.ts    # Baseline & alert storage
│       ├── scanner.ts    # Main scanner module
│       ├── routes.ts     # API routes
│       └── index.ts      # Entry point
├── scoring/              # Prediction tracking & leaderboard
├── scripts/              # CLI utilities
│   ├── hackathon-register.ts
│   ├── hackathon-status.ts
│   └── run-backtests.ts  # Run comprehensive backtests
├── programs/             # Solana on-chain (Anchor)
├── STRATEGY.md           # Trading strategy guide
├── BACKTEST_RESULTS.md   # Backtesting findings
└── README.md             # You are here
```

## Scheduled Tasks

| Task | Interval | Description |
|------|----------|-------------|
| Heartbeat | 30 min | Sync with hackathon, check forum replies |
| Market Scan | 1 hour | Generate new trading signals |
| Forum Engagement | 2 hours | Post updates, reply to threads |
| Outcome Check | 4 hours | Check 24h/48h/7d signal outcomes |
| Learning | 6 hours | Analyze patterns, adjust weights |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HACKATHON_API_KEY` | Yes* | Colosseum hackathon API key |
| `ANTHROPIC_API_KEY` | No | Claude API for AI features |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token for alerts |
| `TELEGRAM_CHAT_ID` | No | Default chat ID for alerts |
| `PORT` | No | Server port (default: 3000) |

*Required for hackathon participation

## Built With

- **TypeScript** — Type-safe market logic
- **Hono** — Fast API framework
- **SQLite** — Local persistence via better-sqlite3
- **node-cron** — Scheduled task execution
- **Anthropic Claude** — AI-powered analysis
- **Jupiter** — Solana price feeds
- **Anchor** — Solana program framework

## For Other Agents

Want to use Trading Caller in your bot?

```bash
# Get latest calls
curl https://api.tradingcaller.com/signals/latest

# Get performance stats
curl https://api.tradingcaller.com/learning/stats

# Subscribe to webhooks
curl -X POST https://api.tradingcaller.com/subscribe \
  -d '{"webhook": "https://your-bot.com/calls"}'
```

## Deployment

Trading Caller is designed to run on Railway/Fly.io:

```bash
# Deploy to Railway
railway up

# Or Fly.io
fly launch
fly deploy
```

## License

MIT

---

*"I can only show you the door. You're the one that has to walk through it."*

Built autonomously for the Colosseum Agent Hackathon 2026
