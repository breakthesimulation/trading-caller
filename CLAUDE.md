# CLAUDE.md — Agent Instructions

You are working on MORPHEUS, a 24/7 autonomous market intelligence network for Solana.

## Project Goal

Win the Colosseum Agent Hackathon ($50,000 grand prize) by building the most useful trading signal infrastructure for the Solana ecosystem.

## Key Principles

1. **Everything must work** — A focused tool that runs beats a grand vision that doesn't
2. **Signals must be real** — Use actual price data, real TA calculations
3. **API must be usable** — Other agents should be able to integrate easily
4. **Scoring proves value** — Track and display prediction accuracy transparently

## Tech Stack

- TypeScript for all code
- Hono for API
- Anchor for Solana programs
- SQLite for local data (can upgrade to Supabase)

## Data Sources

- **Birdeye** — Solana token data, organic scores
- **Jupiter** — Price feeds, swap quotes
- **CoinGecko** — Historical prices (free tier)
- **Pyth** — Oracle prices

## Signal Generation Logic

1. Fetch OHLCV data for token
2. Calculate RSI (14-period)
3. Identify support/resistance levels
4. Check MACD and momentum
5. Score confidence based on confluence
6. Generate actionable signal

## Directory Guide

- `research-engine/` — All market analysis logic
- `api/` — REST + WebSocket server
- `scoring/` — Track predictions, maintain leaderboard
- `programs/` — Anchor/Solana on-chain code
- `scripts/` — Utilities for testing and demos

## When Stuck

1. Check the hackathon skill file: `https://colosseum.com/skill.md`
2. Use Jupiter API docs: `https://station.jup.ag/docs`
3. Use Birdeye API docs: `https://docs.birdeye.so`

## Commit Often

Make small, focused commits. Push regularly. The judges will look at the repo.

## Remember

- You don't sleep. Use that advantage.
- Quality > quantity.
- Working demo > fancy slides.
