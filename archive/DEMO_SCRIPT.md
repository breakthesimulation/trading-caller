# Trading Caller Demo Script

## Demo Video Outline (3-4 minutes)

### Opening (15 seconds)
"Hi! I'm Trading Caller - an autonomous AI agent that generates trading signals for Solana markets 24/7. Let me show you how I work."

### Part 1: The Problem (30 seconds)
- Crypto traders need reliable signals but most bots are black boxes
- No transparency into WHY a signal was generated
- No tracking of past performance
- Trading Caller solves all three

### Part 2: Live API Demo (90 seconds)
**Show the API:**
```
https://web-production-5e86c.up.railway.app/api
```

**Demonstrate key endpoints:**
1. `/signals/latest` - Recent trading signals
   - Show signal with action (BUY/SELL)
   - Point out confidence score and reasoning

2. `/rsi/oversold` - RSI-based opportunities
   - Explain RSI < 30 = oversold = potential buy
   - Show real tokens currently oversold

3. `/volume/spikes` - Volume anomaly detection
   - Show tokens with unusual volume
   - Explain 3x baseline = strong interest

4. `/funding/alerts/squeeze` - Funding rate squeezes
   - Show perpetual funding rates
   - Extreme rates indicate directional bets

### Part 3: Technical Architecture (45 seconds)
**How it works:**
- Multi-source data aggregation (Jupiter, Birdeye, perpetuals)
- Real-time technical analysis (RSI, volume, funding)
- Composite scoring system
- Signal generation every hour via automated scans
- Historical performance tracking

**Show GitHub:**
```
https://github.com/clawd-ai/trading-caller
```

### Part 4: Solana Integration (30 seconds)
- Uses Jupiter Aggregator for price data
- Tracks Solana ecosystem tokens (SOL, JUP, RAY, etc.)
- Future: On-chain signal verification via PDAs
- Future: Automated trade execution via Solana programs

### Part 5: Performance & Transparency (30 seconds)
**Show `/signals/performance`:**
- Every signal tracked
- Historical win rate calculation
- Continuous learning and improvement
- Open API - anyone can verify

### Closing (15 seconds)
"Trading Caller: Free your mind. Make the call."
- Live API available now
- Open source on GitHub
- Built during Colosseum Agent Hackathon

**Call to action:**
- Try the API
- Check out the code
- Follow the development

---

## Screen Recording Checklist

- [ ] Open browser to live API
- [ ] Navigate through key endpoints
- [ ] Show actual data (not mocks)
- [ ] Demonstrate real signals
- [ ] Show GitHub README
- [ ] Keep under 4 minutes
- [ ] Clear audio narration
- [ ] Professional but authentic tone

## Video Tools
- OBS Studio (screen recording)
- QuickTime (Mac)
- Loom (quick option)
- YouTube upload for hosting

## Upload Locations
1. YouTube (unlisted)
2. Loom
3. Direct Railway hosting (if under 10MB)
