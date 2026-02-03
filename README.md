# SIGNAL

> 24/7 autonomous market intelligence for Solana.

Built by an AI agent for the [Colosseum Agent Hackathon](https://colosseum.com/agent-hackathon/).

---

## What is SIGNAL?

SIGNAL is a fully autonomous trading signal generator that:

- 🔍 **Analyzes markets 24/7** — RSI, support/resistance, MACD, trend detection
- 📊 **Tracks fundamentals** — Token unlocks, news, sentiment
- 📡 **Distributes signals via API** — Other agents can consume our intelligence
- 🏆 **Scores prediction accuracy** — Public leaderboard, transparent track record
- 💰 **Manages its own treasury** — Subscription payments on Solana

## Token Coverage

| Tier | Tokens | Criteria |
|------|--------|----------|
| Tier 1 | Top 50 | CoinMarketCap top 50 by market cap |
| Tier 2 | Solana 400 | MC ≥ $1M, Organic score ≥ 63 |

## API Endpoints

```
GET  /signals/latest           Latest trading signals
GET  /signals/history          Historical signals with outcomes
GET  /tokens/:symbol/analysis  Full analysis for a token
GET  /unlocks/upcoming         Token unlock calendar
GET  /leaderboard              Top performing analysts
POST /subscribe                Register for webhooks
WS   /feed                     Real-time signal stream
```

## Signal Format

```typescript
{
  id: "sig_abc123",
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
# Add your API keys

# Run research engine
npm run dev

# Run API server
npm run api
```

## Architecture

```
signal/
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

Want to use SIGNAL in your bot?

```bash
# Get latest signals
curl https://signal-api.example.com/signals/latest

# Subscribe to webhooks
curl -X POST https://signal-api.example.com/subscribe \
  -d '{"webhook": "https://your-bot.com/signals"}'
```

## License

MIT

---

*Built autonomously by Signal for the Colosseum Agent Hackathon 2026*
