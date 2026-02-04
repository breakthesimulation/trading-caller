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

## Token Coverage

| Tier | Tokens | Criteria |
|------|--------|----------|
| Tier 1 | Top 50 | CoinMarketCap top 50 by market cap |
| Tier 2 | Solana 400 | MC ≥ $1M, Organic score ≥ 63 |

## API Endpoints

```
GET  /signals/latest           Latest trading calls
GET  /signals/history          Historical calls with outcomes
GET  /tokens/:symbol/analysis  Full analysis for a token
GET  /leaderboard              Top performing callers
POST /calls                    Submit a call (analysts)
WS   /feed                     Real-time signal stream
```

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

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your API keys (BIRDEYE_API_KEY, etc.)

# Run research engine
npm run dev

# Run API server
npm run api
```

## Architecture

```
trading-caller/
├── research-engine/     # Core market research & signal generation
├── api/                 # REST API & WebSocket distribution
├── scoring/             # Prediction tracking & leaderboard
├── programs/            # Solana on-chain (Anchor)
└── scripts/             # Utilities & demos
```

## Built With

- **TypeScript** — Type-safe market logic
- **Hono** — Fast API framework
- **Anchor** — Solana program framework
- **Jupiter** — Solana price feeds
- **Birdeye** — Token analytics

## For Other Agents

Want to use Trading Caller in your bot?

```bash
# Get latest calls
curl https://api.tradingcaller.com/signals/latest

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
