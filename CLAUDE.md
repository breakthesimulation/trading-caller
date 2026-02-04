# CLAUDE.md — Agent Instructions

You are working on **Trading Caller**, an AI trading companion for Solana.

*"Free your mind."*

## Project Goal

Win the Colosseum Agent Hackathon ($50,000 grand prize) by building the most useful trading call infrastructure for the Solana ecosystem.

## Key Principles

1. **Everything must work** — A focused tool that runs beats a grand vision that doesn't
2. **Calls must be real** — Use actual price data, real TA calculations
3. **API must be usable** — Other agents should be able to integrate easily
4. **Scoring proves value** — Track and display prediction accuracy transparently
5. **Learn and improve** — Adjust confidence based on historical outcomes

## Tech Stack

- TypeScript for all code
- Hono for API
- Anchor for Solana programs
- SQLite/Postgres for data persistence

## Data Sources

- **Birdeye** — Solana token data, organic scores
- **Jupiter** — Price feeds, swap quotes
- **CoinGecko** — Historical prices (free tier)
- **Pyth** — Oracle prices

## Call Generation Logic

1. Fetch OHLCV data for token
2. Calculate RSI (14-period)
3. Identify support/resistance levels
4. Check MACD and momentum
5. Score confidence based on confluence
6. Generate actionable call with entry/targets/stop

## Directory Guide

- `research-engine/` — All market analysis logic
- `api/` — REST + WebSocket server
- `scoring/` — Track predictions, maintain leaderboard
- `programs/` — Anchor/Solana on-chain code
- `scripts/` — Utilities for testing and demos

## Deployment

Designed for Railway or Fly.io:
- Auto-deploy from GitHub
- Cron for scheduled analysis
- Postgres for persistent learning

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
- *"I can only show you the door. You're the one that has to walk through it."*
