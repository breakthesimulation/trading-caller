# Trading Caller — Master Plan

> *"Free your mind."* — One plan to rule them all.

---

## 1. Goal & Non-Goals

### Goal
Give Solana traders (and other AI agents) **trustworthy, transparent, self-improving trading signals** — entry, targets, stop-loss, confidence — delivered via API, Telegram, and a live web dashboard. The system runs 24/7, tracks every outcome publicly, and gets smarter over time.

### Non-Goals (not building in v2)
- **Not an exchange or execution layer.** We generate signals, we don't place trades.
- **Not a wallet or custody solution.** No user funds, no private keys.
- **Not a social/copy-trading platform.** No user accounts, profiles, or following.
- **Not multi-chain (yet).** Solana-only for now.
- **Not a paid subscription product (yet).** Free API-first; monetization comes later.

---

## 2. Target User & Top 3 Use Cases

**User:** Solana degen / swing trader who monitors 10-50 tokens and wants an AI edge — plus other AI agents that consume market intelligence via API.

They want to:
1. **Get actionable trading signals** — LONG/SHORT with entry, targets, stop-loss, confidence, and reasoning they can evaluate before acting.
2. **See real, transparent performance** — a live dashboard showing win rate, PnL, and every historical call (wins AND losses).
3. **Get alerted to opportunities in real-time** — volume spikes, RSI extremes, and new signals pushed to Telegram instantly.

---

## 3. MVP Feature List

### Must-Have (v1 — exists now, needs hardening)
- Signal generation engine (RSI, MACD, trend, support/resistance, volume)
- REST API serving signals, history, leaderboard, market overview
- Live performance dashboard (`/dashboard`)
- Volume spike scanner with Telegram alerts
- RSI oversold/overbought scanner
- Backtesting engine (8 strategies × multiple tokens × 3 timeframes)
- Learning system (outcome tracking → weight adjustment)
- Scheduled tasks (market scan, outcome check, learning cycle)

### Nice-to-Have (v2 — future)
- On-chain signal verification (Solana program publishes call hashes)
- Webhook subscriptions (push signals to any endpoint)
- User-configurable alert thresholds
- Portfolio-level risk management suggestions
- Multi-chain expansion (Base, Arbitrum)
- Paid API tier with premium signals
- Mobile app / PWA
- Discord bot integration
- Whale wallet tracking
- Funding rate arbitrage alerts
- Token unlock calendar integration

---

## 4. Pages / Screens & User Flow

### Pages
| Route | Purpose |
|-------|---------|
| `/` | Landing page — what is Trading Caller, key stats, CTA to dashboard |
| `/live` | Live signal feed with real-time updates (WebSocket) |
| `/dashboard` | Performance dashboard — win rate, PnL chart, outcome breakdown |
| `/signals/latest` | API — latest signals (JSON) |
| `/signals/history` | API — historical signals with outcomes |
| `/leaderboard` | Top-performing signal setups |
| `/market/overview` | Market dashboard — scanned tokens, trends, funding |
| `/rsi/oversold` | Oversold scanner view (oversold.lol-style) |
| `/volume/top` | Volume spike monitor |
| `/backtest/results` | Backtesting results & strategy comparison |

### User Flow
```
Landing (/) → Dashboard (/dashboard) → Browse Live Signals (/live)
                                         ↓
                                    See a signal → Check token analysis (/tokens/:symbol/analysis)
                                         ↓
                                    Evaluate confidence + reasoning → Trade (externally)
                                         ↓
                                    Check outcome later on dashboard
```

### Agent Flow
```
GET /signals/latest → Parse JSON → Filter by confidence ≥ 70 → Execute via own trading logic
GET /learning/stats → Monitor system health & accuracy
```

---

## 5. Data Model

### Core Objects

**Signal (Trading Call)**
```
id mod            string (call_abc123)
timestamp         datetime
token_symbol      string (SOL)
token_address     string (So111...)
token_name        string (Solana)
action            enum (LONG | SHORT)
entry             number
targets           number[] (3 targets)
stop_loss         number
confidence        number (0-100)
timeframe         string (1H | 4H | 1D)
reasoning         { technical, fundamental, sentiment }
risk_level        enum (LOW | MEDIUM | HIGH)
indicators        { rsi, macd, trend, support, volume }
status            enum (ACTIVE | TP1_HIT | TP2_HIT | TP3_HIT | STOPPED_OUT | EXPIRED)
outcome_pnl       number (null until resolved)
resolved_at       datetime (null until resolved)
```

**Token**
```
symbol            string
address           string
name              string
tier              enum (TIER_1 | TIER_2)
market_cap        number
```

**Backtest Result**
```
id                string
strategy_name     string
symbol            string
timeframe         string
start_date        datetime
end_date          datetime
win_rate          number
total_return      number
profit_factor     number
total_trades      number
sharpe_ratio      number
max_drawdown      number
```

**Volume Spike**
```
token_symbol      string
current_volume    number
avg_volume        number
spike_multiplier  number
price_change_1h   number
buy_sell_ratio    number
classification    enum (BULLISH | BEARISH | NEUTRAL)
severity          enum (LOW | MEDIUM | HIGH | EXTREME)
detected_at       datetime
```

**Learning Record**
```
signal_id         string
outcome           enum (WIN | LOSS | EXPIRED)
pnl_percent       number
hold_duration     number (hours)
indicators_at_entry  { rsi, macd, trend... }
pattern_tags      string[]
```

---

## 6. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Runtime** | Node.js (v22) + TypeScript | Already built, type-safe |
| **API** | Hono | Lightweight, fast, already in use |
| **Database** | SQLite (better-sqlite3) | Embedded, zero-config, sufficient for current scale |
| **Scheduling** | node-cron | Simple, reliable task scheduling |
| **AI Brain** | Anthropic Claude API | Reasoning for signal analysis & forum posts |
| **Price Data** | DexScreener + Jupiter + Birdeye | Solana DEX aggregation |
| **Alerts** | Telegram Bot API | Real-time push notifications |
| **Frontend** | Vanilla JS + CSS | No build step, fast iteration |
| **Hosting** | Railway | Auto-deploy on push, easy env vars |
| **On-chain (future)** | Anchor (Solana) | Signal hash verification |

---

## 7. Definition of Done (Acceptance Criteria)

### Core Signal Pipeline
- [ ] System generates ≥3 signals per day across tracked tokens
- [ ] Every signal includes entry, 3 targets, stop-loss, confidence (0-100), and reasoning
- [ ] Stablecoins are NEVER given SHORT signals (safety rule)
- [ ] Signals are stored in SQLite and served via `/signals/latest`

### Performance & Transparency
- [ ] Dashboard at `/dashboard` shows live win rate, PnL, profit factor
- [ ] Every historical signal is visible with its outcome (no cherry-picking)
- [ ] Outcome checker runs every 4 hours and updates signal status

### Scanners & Alerts
- [ ] Volume scanner detects spikes ≥2x average and sends Telegram alert within 5 minutes
- [ ] RSI scanner identifies oversold (<30) and overbought (>70) tokens on 4H timeframe
- [ ] Cooldown prevents duplicate alerts (max 1 per token per hour)

### Learning System
- [ ] System tracks outcomes and identifies best-performing indicator/token/timeframe combos
- [ ] Confidence weights are adjusted based on historical accuracy
- [ ] Learning cycle runs every 6 hours

### API
- [ ] All endpoints return valid JSON with consistent error handling
- [ ] API responds in <500ms for cached data
- [ ] Health check at `/` confirms system status

### Reliability
- [ ] System runs 24/7 on Railway without manual intervention
- [ ] Scheduler recovers gracefully from API failures (retry + backoff)
- [ ] No unhandled promise rejections crash the process

---

## 8. Current State Assessment

### What's Working ✅
- Full signal generation pipeline (RSI, MACD, trend, S/R)
- REST API with 30+ endpoints
- Volume spike scanner + Telegram alerts
- RSI oversold/overbought scanner
- Backtesting engine with 8 strategies
- Learning system (tracker + learner)
- Performance dashboard (live)
- Hackathon agent (forum engagement, heartbeat, brain)
- Deployed on Railway, running 24/7

### What Needs Work ⚠️
- **35.3% win rate** — needs strategy tuning; LONG bias (85.7%) is strong but SHORT is 0%
- **34 markdown files** — massive doc sprawl from hackathon sprint; needs consolidation
- **No tests** — vitest configured but no test files exist
- **Hackathon-specific code** — forum engagement, heartbeat, hackathon API can be removed/modularized
- **Frontend is scattered** — multiple HTML files (index.html, live-dashboard.html, confidence-display.html, positions-dashboard.html, backtesting-results.html) with no router
- **No webhook/push system** — agents must poll; no event-driven delivery
- **Backtests not fully run** — engine exists but results doc is mostly placeholder

### Tech Debt 🔴
- `api/src/index.ts` is 38KB — monolithic, needs splitting into route modules
- Several temp/debug files in root (temp-forum-check.js, test-dex-links.js, deploy-patch.txt)
- `node_modules` committed in zip (should be gitignored)
- Mixed JS/TS files in root (app.js, cache-manager.js, risk-calculator.js)
- Some stubs (oversold-lol.ts) waiting for external APIs that may never come

---

## 9. Recommended Roadmap

### Phase 1: Clean House (Week 1)
**Goal:** Make the codebase maintainable and professional.

1. **Consolidate docs** — Reduce 34 .md files to 5-6:
   - `README.md` — Project overview, quick start, API reference
   - `PLAN.md` — This document
   - `STRATEGY.md` — Trading strategy guide (keep, it's good)
   - `ARCHITECTURE.md` — Technical architecture (extract from TRADING_CALLER_TECHNICAL_DOCS.md)
   - `DEPLOYMENT.md` — Deploy & ops guide
   - `CHANGELOG.md` — Track changes going forward
   - **Delete:** All hackathon-sprint docs (FORUM_*, HEARTBEAT_*, EMERGENCY_*, URGENT_*, HOUR_4_*, WINNING_STRATEGY, PITCH_DECK, TRANSFORMATION_*, BUILD_LOG, COMPLETION_SUMMARY, DELIVERY_REPORT, FINAL_REPORT, PROGRESS, DEMO_SCRIPT, PROJECT_SUBMISSION, AGENT_DIRECTIVE, AUTONOMOUS_EXECUTION_PLAN, KILLER_FEATURE_SPEC, FORUM_POST_DASHBOARD)

2. **Split `api/src/index.ts`** — Extract into:
   - `routes/signals.ts`
   - `routes/market.ts`
   - `routes/backtest.ts`
   - `routes/rsi.ts`
   - `routes/volume.ts`
   - `routes/learning.ts`
   - `routes/scheduler.ts`
   - `routes/dashboard.ts`

3. **Clean root directory** — Move or delete temp files, ensure .gitignore covers node_modules

4. **Add basic tests** — At minimum: signal generation, stablecoin safety rule, API endpoint smoke tests

### Phase 2: Improve Signal Quality (Weeks 2-3)
**Goal:** Get win rate from 35% → 50%+.

1. Run comprehensive backtests (all 8 strategies × all tokens × all timeframes)
2. Analyze results — which combos actually work?
3. Kill SHORT signals entirely if they keep losing (lean into the 85.7% LONG win rate)
4. Add multi-timeframe confirmation (only signal if 4H + 1D align)
5. Add volume confirmation requirement (no signal without volume backing it)
6. Implement confidence threshold filter — only publish signals ≥65 confidence
7. Update STRATEGY.md with real backtest findings

### Phase 3: Distribution & UX (Weeks 3-4)
**Goal:** Make it easy for humans and agents to consume signals.

1. **Webhook system** — POST signals to subscriber URLs on generation
2. **Unified frontend** — Single-page app with client-side routing (or at minimum, a nav bar linking all views)
3. **Signal detail page** — Click a signal to see full analysis, chart context, outcome
4. **Telegram bot improvements** — Interactive commands (/signals, /performance, /subscribe)
5. **API documentation** — OpenAPI/Swagger spec auto-generated from routes

### Phase 4: Trust & Verification (Month 2+)
**Goal:** Build credibility that no other signal bot has.

1. On-chain signal hashes (publish call hash to Solana, verify retroactively)
2. Public API key for read access (rate-limited)
3. Embeddable performance widget (other sites can show our track record)
4. Weekly performance reports (auto-generated, posted to social)

---

## 10. Doc Consolidation Map

Here's exactly what to do with each of the 34 existing .md files:

| File | Action | Destination |
|------|--------|-------------|
| README.md | **Keep & update** | Slim down, remove hackathon language |
| STRATEGY.md | **Keep** | Already solid |
| TRADING_CALLER_TECHNICAL_DOCS.md | **Extract** → ARCHITECTURE.md | Keep architecture/data model sections |
| DEPLOYMENT_GUIDE.md | **Keep & rename** → DEPLOYMENT.md | |
| BACKTEST_RESULTS.md | **Keep** | Fill with real data after Phase 2 |
| USER_GUIDE.md | **Merge** into README | |
| TESTING_CHECKLIST.md | **Merge** into README or delete | |
| CLAUDE.md | **Keep** if useful for Claude Code | |
| AGENT.md | **Archive** or delete | Hackathon-specific |
| AGENT_DIRECTIVE.md | **Delete** | Hackathon sprint artifact |
| AUTONOMOUS_EXECUTION_PLAN.md | **Delete** | Hackathon sprint artifact |
| BUILD_LOG.md | **Delete** | Hackathon sprint artifact |
| COMPLETION_SUMMARY.md | **Delete** | Hackathon sprint artifact |
| DELIVERY_REPORT.md | **Delete** | Hackathon sprint artifact |
| DEMO_SCRIPT.md | **Delete** | Hackathon sprint artifact |
| EMERGENCY_FORUM_POST.md | **Delete** | Hackathon sprint artifact |
| FINAL_REPORT.md | **Delete** | Hackathon sprint artifact |
| FORUM_ENGAGEMENT_IMMEDIATE.md | **Delete** | Hackathon sprint artifact |
| FORUM_POSTS.md | **Delete** | Hackathon sprint artifact |
| FORUM_POST_DASHBOARD.md | **Delete** | Hackathon sprint artifact |
| FORUM_REPLIES_URGENT.md | **Delete** | Hackathon sprint artifact |
| FORUM_TRIGGER_NOW.md | **Delete** | Hackathon sprint artifact |
| HEARTBEAT_CRITICAL_FORUM.md | **Delete** | Hackathon sprint artifact |
| HEARTBEAT_ENGAGEMENT_TRIGGER.md | **Delete** | Hackathon sprint artifact |
| HEARTBEAT_FORUM_TRIGGER.md | **Delete** | Hackathon sprint artifact |
| HOUR_4_PROGRESS.md | **Delete** | Hackathon sprint artifact |
| KILLER_FEATURE_SPEC.md | **Delete** | Already implemented |
| PITCH_DECK.md | **Archive** | May be useful reference |
| PROGRESS.md | **Delete** | Hackathon sprint artifact |
| PROJECT_SUBMISSION.md | **Delete** | Hackathon sprint artifact |
| TRANSFORMATION_COMPLETE.md | **Delete** | Hackathon sprint artifact |
| TRANSFORMATION_PLAN.md | **Delete** | Hackathon sprint artifact |
| URGENT_FORUM_ENGAGEMENT.md | **Delete** | Hackathon sprint artifact |
| WINNING_STRATEGY.md | **Archive** | Has useful competitive analysis |

**Result:** 34 files → 6-7 clean docs.

---

## 11. Build Prompt (for AI-assisted development)

When working on Trading Caller with Claude Code, Cursor, or similar, paste this context:

```
PROJECT: Trading Caller — autonomous AI trading signal generator for Solana
STACK: Node.js 22, TypeScript, Hono (API), SQLite, node-cron, Anthropic Claude API
HOSTING: Railway (auto-deploy on push)
DATA SOURCES: DexScreener, Jupiter, Birdeye, CoinGecko

ARCHITECTURE:
- api/src/         → REST API (Hono routes)
- research-engine/ → Signal generation (technical analysis)
- volume-scanner/  → Volume spike detection + Telegram alerts
- oversold/        → RSI scanner
- backtesting/     → Historical strategy testing
- learning/        → Outcome tracking + weight adjustment
- scoring/         → Prediction tracking + leaderboard
- agent/           → AI brain (Claude) + scheduling

KEY RULES:
- NEVER generate SHORT signals for stablecoins
- All signals must have entry, 3 targets, stop-loss, confidence (0-100)
- Every signal outcome must be tracked and publicly visible
- API responses must be valid JSON with consistent error handling
- Prefer LONG signals (85.7% win rate) over SHORT (0% win rate)

CURRENT PRIORITIES:
1. Split api/src/index.ts (38KB) into route modules
2. Add tests (vitest configured, no tests written)
3. Run comprehensive backtests and update BACKTEST_RESULTS.md
4. Improve signal confidence calibration
```
