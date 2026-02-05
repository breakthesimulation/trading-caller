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
├── db/                   # SQLite database
├── learning/             # Outcome tracking & self-improvement
│   ├── tracker.ts        # Signal outcome tracking
│   └── learner.ts        # Pattern analysis & insights
├── research-engine/      # Core market research & signals
├── scoring/              # Prediction tracking & leaderboard
├── scripts/              # CLI utilities
│   ├── hackathon-register.ts
│   └── hackathon-status.ts
└── programs/             # Solana on-chain (Anchor)
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
