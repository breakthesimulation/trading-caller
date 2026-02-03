# MORPHEUS Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MORPHEUS System                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐    ┌──────────────────┐    ┌────────────────┐ │
│  │  Research Engine │───▶│    API Server    │───▶│ WebSocket Feed │ │
│  └──────────────────┘    └──────────────────┘    └────────────────┘ │
│           │                       │                                  │
│           ▼                       ▼                                  │
│  ┌──────────────────┐    ┌──────────────────┐                       │
│  │  Scoring Engine  │    │  Solana Program  │                       │
│  └──────────────────┘    └──────────────────┘                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                    │                     │
                    ▼                     ▼
        ┌────────────────────┐    ┌────────────────────┐
        │   Data Sources     │    │    Consumers       │
        │  - Jupiter API     │    │  - Trading Bots    │
        │  - Birdeye API     │    │  - Other Agents    │
        │  - Pyth Oracle     │    │  - Human Traders   │
        └────────────────────┘    └────────────────────┘
```

## Components

### 1. Research Engine (`/research-engine`)

The core analysis engine that generates trading signals.

**Modules:**
- `technical/` — RSI, MACD, Support/Resistance, Trend Analysis
- `fundamental/` — Token unlocks, news sentiment (future)
- `signals/` — Signal generation and types
- `data/` — Jupiter, Birdeye API integrations

**Data Flow:**
```
OHLCV Data → Technical Analysis → Signal Generator → TradingSignal
```

**Signal Generation Logic:**
1. Fetch multi-timeframe OHLCV (1H, 4H, 1D)
2. Calculate RSI (14-period)
3. Calculate MACD (12, 26, 9)
4. Detect support/resistance levels
5. Analyze trend direction and strength
6. Score confidence based on indicator confluence
7. Generate actionable signal with entry/targets/stop

### 2. API Server (`/api`)

REST + WebSocket server for signal distribution.

**Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/signals/latest` | GET | Latest signals |
| `/signals/history` | GET | Historical signals |
| `/tokens/:symbol/analysis` | GET | Token analysis |
| `/calls` | POST | Submit analyst call |
| `/leaderboard` | GET | Analyst rankings |
| `/subscribe` | POST | Webhook subscription |

**Tech Stack:**
- Hono (fast HTTP framework)
- WebSocket for real-time feed

### 3. Scoring Engine (`/scoring`)

Tracks analyst predictions and calculates performance.

**Metrics Tracked:**
- Win rate
- Average return
- Profit factor
- Sharpe ratio (future)

**Call Resolution:**
- WIN: Price hits target
- LOSS: Price hits stop loss
- NEUTRAL: Timeframe expires without hitting either

### 4. Solana Program (`/programs/morpheus-treasury`)

On-chain components for subscriptions and verification.

**Instructions:**
- `initialize` — Set up treasury with pricing
- `subscribe` — Process USDC subscription payment
- `check_subscription` — Verify active subscription
- `store_signal_hash` — Store signal hash for verification
- `withdraw` — Authority withdraws accumulated fees

**Accounts:**
- `Treasury` — Configuration and stats
- `Subscription` — Per-user subscription state
- `SignalRecord` — On-chain signal verification

## Data Sources

### Jupiter API
- Real-time price feeds
- Swap quotes (liquidity check)
- Token list

### Birdeye API
- OHLCV historical data
- Token analytics
- Organic scores
- Market cap data

### Pyth (Future)
- Oracle prices for signal verification
- High-frequency price updates

## Token Coverage

**Tier 1 (Top 50):**
- BTC, ETH, SOL, and top 50 by market cap
- Source: CoinGecko/CoinMarketCap

**Tier 2 (Solana Ecosystem):**
- Market cap ≥ $1,000,000
- Organic score ≥ 63
- Up to 400 tokens

## Signal Format

```typescript
interface TradingSignal {
  id: string;
  timestamp: string;
  token: Token;
  action: 'LONG' | 'SHORT' | 'HOLD' | 'AVOID';
  entry: number;
  targets: number[];
  stopLoss: number;
  confidence: number;  // 0-100
  timeframe: '1H' | '4H' | '1D' | '1W';
  reasoning: {
    technical: string;
    fundamental: string;
    sentiment: string;
  };
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}
```

## Deployment

### Required Environment Variables
```
BIRDEYE_API_KEY=
HELIUS_API_KEY=
SOLANA_RPC_URL=
PORT=3000
```

### Running Locally
```bash
# Install dependencies
npm install

# Run research engine
npm run dev

# Run API server
npm run api

# Run tests
npm run test
```

### Production Deployment
- Research engine: Cron job or continuous process
- API: Railway, Render, or Vercel
- Solana program: Devnet → Mainnet

## Security Considerations

1. **API Keys** — Never expose in code or logs
2. **Rate Limiting** — Respect data source limits
3. **Signal Integrity** — Hash signals on-chain
4. **Subscription Verification** — Check on-chain before serving premium data

## Future Enhancements

1. **Machine Learning** — Improve signal confidence with ML models
2. **Multi-chain** — Expand beyond Solana
3. **Social Sentiment** — Twitter/Discord sentiment analysis
4. **Automated Trading** — Optional trade execution
5. **DAO Governance** — Decentralize signal curation
