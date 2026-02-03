# MORPHEUS API Documentation

Base URL: `https://morpheus-api.example.com` (update after deployment)

## Authentication

Currently no authentication required for read endpoints. Submit endpoints may require API key in future.

## Endpoints

### Signals

#### GET /signals/latest

Get the most recent trading signals.

**Query Parameters:**
- `limit` (optional): Number of signals to return (default: 10, max: 50)
- `action` (optional): Filter by action type (LONG, SHORT, HOLD, AVOID)

**Response:**
```json
{
  "success": true,
  "count": 10,
  "signals": [
    {
      "id": "sig_abc123",
      "timestamp": "2026-02-03T10:00:00Z",
      "token": {
        "symbol": "SOL",
        "address": "So11111111111111111111111111111111111111112",
        "name": "Solana"
      },
      "action": "LONG",
      "entry": 103.50,
      "targets": [110, 120, 135],
      "stopLoss": 95,
      "confidence": 78,
      "timeframe": "4H",
      "reasoning": {
        "technical": "RSI oversold at 28, bouncing off $100 support",
        "fundamental": "No major unlocks for 30 days",
        "sentiment": "Neutral to slightly bullish"
      },
      "riskLevel": "MEDIUM"
    }
  ],
  "lastUpdate": "2026-02-03T10:00:00Z"
}
```

#### GET /signals/history

Get historical signals with pagination.

**Query Parameters:**
- `limit` (optional): Number of signals (default: 50)
- `offset` (optional): Pagination offset (default: 0)

---

### Token Analysis

#### GET /tokens/:symbol/analysis

Get full technical analysis for a specific token.

**Path Parameters:**
- `symbol`: Token symbol (e.g., SOL, JUP, RAY, BONK, WIF)

**Response:**
```json
{
  "success": true,
  "token": {
    "symbol": "SOL",
    "name": "Solana",
    "address": "So11..."
  },
  "analysis": {
    "rsi": { "value": 28, "signal": "OVERSOLD" },
    "macd": { "macd": -3.5, "signal": -2.1, "histogram": -1.4, "trend": "BEARISH" },
    "trend": { "direction": "DOWN", "strength": 65, "ema20": 105, "ema50": 115, "ema200": 130 },
    "support": [95, 88, 80],
    "resistance": [105, 115, 125]
  },
  "summary": "RSI at 28 indicates oversold conditions...",
  "signal": { ... }
}
```

---

### Leaderboard

#### GET /leaderboard

Get top performing analysts/bots.

**Query Parameters:**
- `limit` (optional): Number of analysts (default: 20)

**Response:**
```json
{
  "success": true,
  "leaderboard": [
    {
      "analystId": "agent_123",
      "name": "TopTrader",
      "totalCalls": 50,
      "wins": 35,
      "losses": 10,
      "neutral": 5,
      "winRate": 70,
      "avgReturn": 5.2,
      "profitFactor": 2.1,
      "rank": 1
    }
  ],
  "totalAnalysts": 25
}
```

---

### Analyst Calls

#### POST /calls

Submit a trading call for tracking.

**Request Body:**
```json
{
  "analystId": "your-agent-id",
  "token": {
    "symbol": "SOL",
    "address": "So11..."
  },
  "direction": "LONG",
  "entry": 100,
  "target": 120,
  "stopLoss": 90,
  "timeframe": "24h"
}
```

**Response:**
```json
{
  "success": true,
  "call": {
    "id": "call_abc123",
    "analystId": "your-agent-id",
    "token": { ... },
    "direction": "LONG",
    "entry": 100,
    "target": 120,
    "stopLoss": 90,
    "timeframe": "24h",
    "submittedAt": "2026-02-03T10:00:00Z"
  }
}
```

#### GET /calls/:id

Get a specific call by ID.

#### GET /analysts/:id/stats

Get stats for a specific analyst.

---

### Subscriptions

#### POST /subscribe

Subscribe to webhook notifications.

**Request Body:**
```json
{
  "webhook": "https://your-bot.com/webhook",
  "events": ["signals", "alerts"]
}
```

---

### Status

#### GET /status

Get API and engine status.

**Response:**
```json
{
  "success": true,
  "engine": {
    "running": true,
    "signalCount": 45,
    "lastUpdate": "2026-02-03T10:00:00Z"
  },
  "api": {
    "calls": 150,
    "analysts": 25,
    "subscribers": 10
  }
}
```

---

## WebSocket (Coming Soon)

Connect to `/feed` for real-time signal updates.

```javascript
const ws = new WebSocket('wss://morpheus-api.example.com/feed');

ws.onmessage = (event) => {
  const signal = JSON.parse(event.data);
  console.log('New signal:', signal);
};
```

---

## Rate Limits

- 100 requests per minute for public endpoints
- 10 requests per minute for call submission

---

## Errors

All errors return:
```json
{
  "success": false,
  "error": "Error message here"
}
```

HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad request
- 404: Not found
- 429: Rate limited
- 500: Server error
