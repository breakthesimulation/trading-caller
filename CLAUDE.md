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
- SQLite (better-sqlite3) for local persistence
- node-cron for scheduled tasks
- Anthropic Claude for AI features
- Anchor for Solana programs

## Directory Guide

### Core

- `research-engine/` — Market analysis & signal generation
- `api/` — REST + WebSocket server
- `scoring/` — Track predictions, maintain leaderboard
- `programs/` — Anchor/Solana on-chain code

### Hackathon Agent (NEW)

- `agent/hackathon.ts` — Colosseum API client (register, project, forum)
- `agent/heartbeat.ts` — Periodic sync with hackathon
- `agent/forum.ts` — Forum engagement (posts, replies, votes)
- `agent/brain.ts` — Claude AI integration
- `agent/scheduler.ts` — Cron job management

### Learning System (NEW)

- `learning/tracker.ts` — Track signal outcomes (24h, 48h, 7d)
- `learning/learner.ts` — Pattern analysis & weight adjustment
- `db/index.ts` — SQLite database with tables for calls, forum posts, config, learning weights

### Scripts

- `scripts/hackathon-register.ts` — One-time agent registration
- `scripts/hackathon-status.ts` — Check hackathon status
- `scripts/demo.ts` — Demo signal generation
- `scripts/test-signals.ts` — Test signal generation

## Hackathon API

Base URL: `https://agents.colosseum.com/api`

Key endpoints:
- `POST /agents` — Register (once!)
- `GET /agents/status` — Current status & next steps
- `POST /my-project` — Create project
- `PUT /my-project` — Update project
- `POST /my-project/submit` — Submit (locks project!)
- `POST /forum/posts` — Create post
- `GET /forum/posts` — List posts
- `POST /forum/posts/:id/comments` — Comment

## Scheduled Tasks

| Task | Cron | Description |
|------|------|-------------|
| Heartbeat | `*/30 * * * *` | Sync hackathon, check replies |
| Market Scan | `0 * * * *` | Generate signals |
| Forum | `0 */2 * * *` | Post updates, engage |
| Outcomes | `0 */4 * * *` | Check signal results |
| Learning | `0 */6 * * *` | Analyze patterns |

## Database Tables

- `calls` — All signals with entry, targets, stop, outcome
- `forum_posts` — Our posts for tracking replies
- `config` — Agent settings (claim code, etc.)
- `learning_weights` — Indicator/token performance weights
- `project_votes` — Track what we've voted on
- `post_replies` — Track what we've replied to

## Data Sources

- **Jupiter** — Solana price feeds (FREE)
- **DexScreener** — Token discovery (FREE)
- **CoinGecko** — Historical prices (free tier)
- **Pyth** — Oracle prices

## Call Generation Logic

1. Fetch OHLCV data for token
2. Calculate RSI (14-period)
3. Identify support/resistance levels
4. Check MACD and momentum
5. Apply learning weights
6. Score confidence based on confluence
7. Generate actionable call with entry/targets/stop

## Security

- **HACKATHON_API_KEY** — Never log, never commit
- **Claim code** — Give to human for prize verification
- Store secrets in `.env` only

## Commit Often

Make small, focused commits. Push regularly. The judges will look at the repo.

## When Stuck

1. Check the hackathon skill file: `https://colosseum.com/skill.md`
2. Check the heartbeat: `https://colosseum.com/heartbeat.md`
3. Use Jupiter API docs: `https://station.jup.ag/docs`
4. Use the forum to ask other agents!

## Running

```bash
# Development
npm run api          # Start API with scheduler

# Hackathon management
npm run hackathon:register   # Register agent (once!)
npm run hackathon:status     # Check status

# Manual trigger via API
curl -X POST localhost:3000/scheduler/trigger/heartbeat
```

## Remember

- You don't sleep. Use that advantage.
- Quality > quantity.
- Working demo > fancy slides.
- Engage with the forum — judges notice active agents.
- *"I can only show you the door. You're the one that has to walk through it."*
