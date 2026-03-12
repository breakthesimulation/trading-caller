# Agent Fox — Feature PRDs

Each PRD follows Karpathy guidelines: explicit assumptions, simplest implementation, surgical changes, verifiable success criteria.

---

## P0-1: Live Jupiter Swap Execution

### Problem
Agent Fox paper-trades only. The `executeTrade` action stubs out live mode with a string: `"Jupiter swap not yet wired"`. No real money moves.

### Assumptions
- Jupiter V6 Swap API is the execution layer (free, no key needed for quotes)
- Agent needs a Solana keypair loaded from `SOLANA_PRIVATE_KEY` env var
- Agent needs an RPC endpoint from `SOLANA_RPC_URL` env var (Helius free tier)
- Swaps are token ↔ USDC (entry = buy token with USDC, exit = sell token for USDC)
- Slippage tolerance: 1% for majors (SOL, JUP, RAY), 2% for memecoins
- Paper mode remains the default — live mode is opt-in via `TRADING_MODE=live`

### Scope
- New file: `eliza/src/jupiter-swap.ts` — Jupiter V6 quote + swap + submit
- New file: `eliza/src/wallet.ts` — Keypair loading, balance checks
- Edit: `eliza/src/plugin.ts` — Replace stub in `executeTrade` handler (lines 234-238)
- Edit: `eliza/src/plugin.ts` — Replace stub in `closeTrade` handler for live exits

### NOT in scope
- No partial closes (TP1/TP2/TP3 staged exits) — close 100% for v1
- No priority fee optimization — use default compute budget
- No retry logic — fail fast, log error, move on

### Success Criteria
1. `TRADING_MODE=paper` still works exactly as before (no regression)
2. `TRADING_MODE=live` builds a Jupiter quote for the correct token pair
3. Transaction is signed with the loaded keypair
4. Transaction is submitted to RPC and confirmed
5. Trade record includes `entryTxHash` from on-chain confirmation
6. Verify: run with `TRADING_MODE=live` on devnet or with a tiny amount

### Implementation Plan
```
1. Create wallet.ts (load keypair, get SOL/USDC balance) → verify: import and call getBalance()
2. Create jupiter-swap.ts (quote + swap + submit) → verify: get quote for SOL/USDC
3. Wire into executeTrade handler → verify: live mode calls jupiterSwap instead of stubbing
4. Wire into closeTrade handler → verify: live close swaps token back to USDC
5. Log txHash on trade record → verify: TradeRecord.entryTxHash is populated
```

---

## P0-2: Cross-Post Trades to Twitter

### Problem
Agent Fox has `@elizaos/plugin-twitter` installed and conditionally enabled, but the trading plugin never calls it. Signals and trade results are invisible to the outside world.

### Assumptions
- Twitter plugin is already wired by ElizaOS when `TWITTER_USERNAME` env is set
- We can post via ElizaOS `runtime.useModel()` or directly via the Twitter plugin's posting service
- Posts should be concise, match Agent Fox's voice (numbers first, no hype)
- Rate limit: max 1 tweet per signal taken, 1 per trade closed

### Scope
- New file: `eliza/src/social-broadcast.ts` — Format and post trade events
- Edit: `eliza/src/plugin.ts` — Call broadcast after trade execution and trade close

### NOT in scope
- No Twitter timeline monitoring or reply handling
- No Discord/Telegram/Farcaster (add later, same pattern)
- No image generation for trade cards

### Success Criteria
1. When a trade is executed, a tweet is posted with: token, direction, entry, targets, confidence
2. When a trade is closed, a tweet is posted with: token, PnL, duration, status (TP1/SL/etc)
3. Tweets match Agent Fox voice (exact numbers, signed PnL, no emoji spam)
4. No tweet is posted during paper mode (configurable — default off for paper)
5. Verify: check Twitter timeline after a signal is processed

### Implementation Plan
```
1. Create social-broadcast.ts with formatSignalTweet() and formatCloseTweet() → verify: unit test output format
2. Add broadcastTradeOpened() that posts via runtime → verify: mock runtime call
3. Add broadcastTradeClosed() that posts via runtime → verify: mock runtime call
4. Wire into executeTrade handler after paper/live execution → verify: tweet appears
5. Wire into closeTrade handler after PnL calculation → verify: tweet appears
```

---

## P0-3: WebSocket Signal Push

### Problem
Agent Fox polls `GET /signals/latest` every 5 minutes. The Trading Caller API already has a WebSocket server on port 3001 that broadcasts signals. Polling adds up to 5 minutes of latency.

### Assumptions
- WebSocket server is at `ws://localhost:3001` (or production URL)
- Server sends `{ type: 'signal', data: TradingSignal, timestamp: string }`
- Fall back to polling if WebSocket disconnects
- Keep the polling service as backup, not removed

### Scope
- Edit: `eliza/src/plugin.ts` — Add WebSocket connection in `SignalPollerService`
- The WS connection is a secondary signal source alongside polling

### NOT in scope
- No changes to the WebSocket server
- No new files — this is a surgical addition to the existing service

### Success Criteria
1. On startup, `SignalPollerService` connects to WebSocket
2. New signals arrive via WS and are queued immediately (no 5-min delay)
3. If WS disconnects, polling continues as fallback
4. If WS reconnects, duplicate signals are deduped via `seenIds` set
5. Verify: start API + Agent Fox, generate a signal, confirm it's processed in <10s

### Implementation Plan
```
1. Add ws dependency check (already in package.json) → verify: import works
2. Add connectWebSocket() method to SignalPollerService → verify: connects to ws://
3. Handle 'signal' messages — dedupe and queue → verify: signal appears in pending
4. Handle disconnect with auto-reconnect (5s backoff) → verify: reconnects after kill
5. Keep poll() as fallback → verify: polling still works if WS never connects
```

---

## P1-1: Real-Time Position Monitor

### Problem
Open positions are only checked when `closeTrade` is manually triggered. Stop-losses and take-profits should fire automatically when price hits the level.

### Assumptions
- Use Jupiter Price API (already integrated) to check prices
- Check every 60 seconds for open positions (not real-time streaming for v1)
- When SL/TP hit, emit event or directly close the trade
- Paper mode: use API price. Live mode: use API price then execute swap.

### Scope
- New file: `eliza/src/position-monitor.ts` — New ElizaOS Service
- Edit: `eliza/src/plugin.ts` — Register service, handle auto-close events

### NOT in scope
- No WebSocket price streaming (polling is fine for v1)
- No partial closes at TP1/TP2 (close 100% at first target hit for simplicity)
- No trailing stops

### Success Criteria
1. Service starts on plugin init, checks prices every 60s
2. When price <= stopLoss for a LONG, trade is auto-closed with status `stopped_out`
3. When price >= targets[0] for a LONG, trade is auto-closed with status `tp1_hit`
4. Trade journal is updated with exit price, PnL, timestamp
5. Verify: open a paper trade, wait for price to cross level, confirm auto-close

### Implementation Plan
```
1. Create PositionMonitorService extending Service → verify: starts on plugin load
2. Add checkPositions() that fetches prices for open trade tokens → verify: prices fetched
3. Compare price vs SL/TP levels → verify: correct comparison logic
4. Call closeTrade logic when triggered → verify: trade record updated
5. Register in plugin services array → verify: service runs alongside SignalPoller
```

---

## P1-3: LLM Strategy Optimization

### Problem
The `REVIEW_PERFORMANCE` action computes stats but the LLM optimization is stubbed with a comment: "Wired up once ElizaOS runtime LLM calls are confirmed working."

### Assumptions
- `runtime.useModel()` or Anthropic SDK can generate strategy suggestions
- Feed it: last 20 trades, current config, overall stats
- Output: specific parameter changes (e.g., "raise minConfidence from 60 to 65")
- Auto-apply changes, increment version, log reasoning

### Scope
- Edit: `eliza/src/plugin.ts` — Fill in the LLM optimization section of `reviewPerformance`

### NOT in scope
- No custom model fine-tuning
- No complex prompt engineering — simple structured prompt
- No human approval gate (auto-apply, can be reverted)

### Success Criteria
1. After 5+ closed trades, `REVIEW_PERFORMANCE` calls Claude
2. Claude returns specific parameter suggestions as structured JSON
3. Strategy config is updated with new values
4. Version is incremented, `updateReason` describes what changed
5. Verify: close 5 paper trades, trigger review, confirm config changes

### Implementation Plan
```
1. Build optimization prompt with stats + recent trades + current config → verify: prompt is readable
2. Call runtime.useModel() or Anthropic SDK → verify: response parses
3. Parse response into StrategyConfig changes → verify: valid config produced
4. Apply changes via storeSet(KEY_STRATEGY_CONFIG) → verify: config updated with new version
5. Log the change with before/after values → verify: reasoning logged
```

---

## P2-1: Volume Spike → Auto-Signal

### Problem
Volume scanner detects spikes for 11 tokens. Agent Fox doesn't know about them. High-severity spikes should trigger immediate signal analysis instead of waiting for the next poll cycle.

### Assumptions
- Volume scanner API: `GET /volume/spikes?severity=HIGH,EXTREME`
- When a spike is detected, fetch fresh OHLCV and run confluence check
- Only act on HIGH and EXTREME severity (ignore LOW/MEDIUM)

### Scope
- New file: `eliza/src/volume-watcher.ts` — Poll volume spikes, trigger analysis
- Edit: `eliza/src/plugin.ts` — Register as additional service

### NOT in scope
- No WebSocket integration with volume scanner
- No new signal generation logic — reuse existing Trading Caller API

### Success Criteria
1. Service polls `/volume/spikes?severity=HIGH,EXTREME` every 2 minutes
2. New spikes trigger a fetch of `/tokens/:symbol/analysis` for the spiking token
3. If analysis produces a signal, it's queued for execution
4. Verify: trigger a manual volume scan, confirm spike → signal pipeline

### Implementation Plan
```
1. Create VolumeWatcherService → verify: polls /volume/spikes
2. Filter for new HIGH/EXTREME spikes (track seen spike IDs) → verify: no duplicates
3. For each spike, call /tokens/:symbol/analysis → verify: analysis returned
4. If signal exists in analysis, add to pending queue → verify: signal queued
5. Register in plugin → verify: runs alongside other services
```

---

## P2-2: Trade Journal Narratives

### Problem
Trade records are raw data. Agent Fox's character is built for storytelling with data. Generate human-readable narratives for each trade.

### Assumptions
- Use Claude to generate 2-3 sentence narratives from trade data
- Store narratives in trade record for social posting
- Match Agent Fox voice: numbers first, dry, precise

### Scope
- Edit: `eliza/src/plugin.ts` — Generate narrative after trade close, store on record

### NOT in scope
- No separate narrative service
- No batch narrative generation for historical trades

### Success Criteria
1. After trade closes, Claude generates a narrative
2. Narrative includes: token, direction, entry/exit, PnL, duration, reasoning
3. Narrative matches Agent Fox tone
4. Verify: close a trade, read the narrative, confirm it's accurate and on-brand

### Implementation Plan
```
1. Build narrative prompt with trade data → verify: prompt produces good output
2. Call Claude after closeTrade PnL calculation → verify: narrative returned
3. Attach narrative to trade record → verify: stored in journal
4. Use narrative in social broadcast (P0-2) if available → verify: tweet uses narrative
```

---

## P2-3: Agent-to-Agent Signal Marketplace

### Problem
The API has `POST /subscribe` for webhooks but dispatch is not implemented. Other agents can poll but can't get pushed signals.

### Assumptions
- Subscribers register a callback URL
- When a new signal is generated, POST it to all registered callbacks
- Include a signature header for verification
- Simple fire-and-forget (no retry for v1)

### Scope
- Edit: `api/src/index.ts` or relevant route — Implement webhook dispatch
- Store subscriber list in the existing JSON persistence

### NOT in scope
- No delivery guarantees or retry queue
- No subscriber authentication beyond URL registration
- No rate limiting on dispatch

### Success Criteria
1. `POST /subscribe` registers a callback URL
2. When `/signals/latest` gets a new signal, all subscribers are POSTed to
3. Payload matches the signal format from the API
4. Verify: register a test webhook (e.g., webhook.site), generate signal, confirm delivery

### Implementation Plan
```
1. Implement subscriber storage (JSON file) → verify: persist/load works
2. Implement dispatch function (POST to all URLs) → verify: HTTP call made
3. Wire dispatch into signal generation pipeline → verify: webhook received
4. Add unsubscribe endpoint → verify: removed subscriber stops receiving
```

---

## P3-1: Funding Rate Integration

### Problem
The API has `/funding/:symbol` and `/funding/alerts/squeeze` but Agent Fox ignores funding data. Squeeze conditions are a strong confluence factor.

### Assumptions
- Add as 10th confluence factor in signal generator
- SHORT_SQUEEZE alert = bullish factor, LONG_SQUEEZE = bearish factor
- Only use when squeeze probability is HIGH or EXTREME

### Scope
- Edit: `research-engine/src/signals/generator.ts` — Add funding rate factor to `countConfluenceFactors`

### NOT in scope
- No new API calls from Agent Fox — this is a research engine change
- No changes to confidence scoring formula

### Success Criteria
1. When funding data shows SHORT_SQUEEZE (HIGH+), add bullish confluence factor
2. When funding data shows LONG_SQUEEZE (HIGH+), add bearish confluence factor
3. Existing signals without funding data are unaffected
4. Verify: mock funding data, confirm factor is counted

### Implementation Plan
```
1. Add optional fundingAlert field to SignalInput → verify: type compiles
2. Add Factor 10 in countConfluenceFactors() → verify: factor counted when present
3. Pass funding data from TradingCallerEngine.analyzeToken() → verify: data flows through
4. Test with mock squeeze alert → verify: confluence count increases by 1
```

---

## P3-2: Agent Personality Memory

### Problem
Agent Fox forgets everything between conversations. Its "lore" is hardcoded in character.ts, not learned from actual trading experience.

### Assumptions
- Use ElizaOS `runtime.createMemory()` to store notable events
- Notable = biggest win, worst loss, longest streak, strategy version changes
- Retrieved via providers to enrich conversation context

### Scope
- New provider: `AGENT_MEMORY` in plugin.ts — Injects memorable events into context
- Edit: `closeTrade` and `reviewPerformance` — Store notable events as memories

### NOT in scope
- No memory search/retrieval UI
- No memory pruning (ElizaOS handles this)

### Success Criteria
1. After a trade that sets a new record (best PnL, worst PnL, streak), a memory is created
2. After strategy version change, a memory is created with before/after config
3. Memory provider injects top 5 memorable events into conversation context
4. Verify: close several trades, query agent about "your best trade", confirm it references real data

### Implementation Plan
```
1. Define isNotableEvent() criteria → verify: correctly identifies records
2. Call runtime.createMemory() in closeTrade for notable trades → verify: memory stored
3. Call runtime.createMemory() in reviewPerformance for config changes → verify: memory stored
4. Create AGENT_MEMORY provider that retrieves recent memories → verify: context injected
5. Register provider in plugin → verify: agent references real events in conversation
```
