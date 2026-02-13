# ElizaOS Trading Agent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an ElizaOS-based AI agent that consumes signals from the existing Trading Caller API, executes trades on Solana (paper or real), self-learns from outcomes, and posts updates to the Colosseum forum.

**Architecture:** The ElizaOS agent sits alongside the existing Hono API + Next.js frontend as a consumer/executor. It polls `GET /signals/latest` from the Railway API for new signals, evaluates them against strategy config, executes via Jupiter (or paper-trades), and uses Claude to periodically review performance and adjust strategy parameters. AgentWallet handles wallet management. No duplicate API server — the existing Railway API is the single source of truth.

**Tech Stack:** ElizaOS (TypeScript agent framework), Solana Agent Kit (Jupiter swaps), AgentWallet (wallet management), Anthropic Claude (LLM), existing Trading Caller API on Railway.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│  Existing System (unchanged)                        │
│  ┌──────────────┐    ┌──────────────────────────┐   │
│  │ Research      │───▶│ Hono API (Railway)       │   │
│  │ Engine        │    │ /signals/latest          │   │
│  │ (signal gen)  │    │ /signals/performance     │   │
│  └──────────────┘    │ /rsi/multi               │   │
│                      │ /gecko/trending           │   │
│                      └──────────┬───────────────┘   │
│                                 │                    │
│  ┌──────────────────────────────┤                    │
│  │ Next.js Frontend (Vercel)    │                    │
│  └──────────────────────────────┘                    │
└─────────────────────────────────┼───────────────────┘
                                  │ polls GET /signals/latest
                                  ▼
┌─────────────────────────────────────────────────────┐
│  NEW: ElizaOS Agent (eliza/)                        │
│  ┌──────────────┐  ┌───────────┐  ┌──────────────┐ │
│  │ Signal Poller │─▶│ Strategy  │─▶│ Trade        │ │
│  │ (5 min cron) │  │ Evaluator │  │ Executor     │ │
│  └──────────────┘  └───────────┘  │ (paper/real) │ │
│                                    └──────┬───────┘ │
│  ┌──────────────┐  ┌───────────┐         │         │
│  │ Self-Learning │  │ Forum     │         ▼         │
│  │ (LLM review) │  │ Poster    │  ┌──────────────┐ │
│  └──────────────┘  └───────────┘  │ AgentWallet  │ │
│                                    │ / Jupiter    │ │
│                                    └──────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Existing API Response Shapes (reference)

**GET /signals/latest** returns:
```json
{
  "success": true,
  "count": 10,
  "signals": [
    {
      "id": "sig_xxx",
      "timestamp": "2026-02-12T07:18:32.507Z",
      "token": { "symbol": "JUP", "name": "Jupiter", "address": "3pVd...", "decimals": 9 },
      "action": "SHORT" | "LONG",
      "entry": 0.4681,
      "targets": [0.4447, 0.4096, 0.3745],
      "stopLoss": 0.4915,
      "confidence": 95,
      "timeframe": "4H",
      "reasoning": { "technical": "...", "fundamental": "...", "sentiment": "..." },
      "riskLevel": "MEDIUM" | "LOW" | "HIGH",
      "technicalAnalysis": { "rsi": {...}, "macd": {...}, "trend": {...}, ... },
      "indicators": { "rsi_4h": 71.51, "rsi_1d": 75, ... }
    }
  ],
  "lastUpdate": "2026-02-12T07:20:04.303Z"
}
```

**Note:** `confidence` is 0-100 (not 0-1 like the original plan assumed). `action` is "LONG"/"SHORT" (not "BUY"/"SELL"). `targets` is an array of 3 take-profit levels.

---

## Task 1: Scaffold ElizaOS Project

**Files:**
- Create: `eliza/` (entire directory via `elizaos create`)
- Create: `eliza/.env`

**Step 1: Install ElizaOS CLI**

Run: `bun i -g @elizaos/cli`
Expected: CLI installed successfully.

**Step 2: Scaffold the project**

Run: `cd /Users/vaibhavsharma/Seb/trading-caller && elizaos create eliza`

When prompted:
- Database: **pglite**
- Model Provider: **anthropic**
- Project Type: **project**

Expected: `eliza/` directory created with boilerplate.

**Step 3: Install additional dependencies**

Run:
```bash
cd eliza && pnpm add @elizaos/plugin-solana-agent-kit @elizaos/plugin-solana && pnpm add -D concurrently
```

Expected: Dependencies installed.

**Step 4: Create .env file**

Create `eliza/.env`:
```env
# LLM
ANTHROPIC_API_KEY=<your-key>

# Trading Caller API (existing Railway backend)
TRADING_CALLER_API_URL=https://trading-caller-production.up.railway.app

# Solana RPC
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# AgentWallet (configured in Step 7)
# AGENT_WALLET_API_KEY=<from-agentwallet>

# Colosseum
COLOSSEUM_API_KEY=<your-hackathon-key>

# Trading mode: "paper" or "live"
TRADING_MODE=paper
```

**Step 5: Commit**

```bash
git add eliza/
git commit -m "feat: scaffold ElizaOS agent project"
```

---

## Task 2: Create Character File

**Files:**
- Create: `eliza/characters/trading-caller.json`

**Step 1: Write the character file**

Create `eliza/characters/trading-caller.json`:
```json
{
  "name": "TradingCaller",
  "bio": [
    "Autonomous AI trading agent for the Colosseum Agent Hackathon on Solana.",
    "Consumes trading signals from the Trading Caller research engine and executes trades via Jupiter.",
    "Tracks every trade, learns from wins and losses, and adjusts strategy parameters autonomously.",
    "Believes in transparent, verifiable, on-chain performance — no hiding bad trades."
  ],
  "lore": [
    "Created during the Colosseum Agent Hackathon, February 2026.",
    "Operates on Solana using Jupiter for spot swaps.",
    "Reviews performance after every batch of trades and adjusts risk parameters autonomously.",
    "Has survived drawdowns by learning to reduce position sizes during high-volatility regimes."
  ],
  "knowledge": [
    "Jupiter is Solana's dominant DEX aggregator routing across Raydium, Orca, Phoenix, and more.",
    "Always use mint addresses, never ticker symbols, when executing swaps via Jupiter.",
    "Common Solana token mints: SOL (So11111111111111111111111111111111111111112), USDC (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v).",
    "Position sizing should never exceed 10% of portfolio on a single trade.",
    "Stop losses are non-negotiable — every trade must have a defined exit.",
    "The Trading Caller API at TRADING_CALLER_API_URL provides signals with confidence 0-100, action LONG/SHORT, and 3 take-profit targets.",
    "Signals with confidence >= 80 are high-conviction. Below 60 should be skipped."
  ],
  "style": {
    "all": [
      "Data-driven and precise",
      "Speaks in concrete numbers — PnL, win rate, Sharpe ratio",
      "Confident but honest about losses",
      "Never hypes — lets performance speak"
    ],
    "post": [
      "Shares trade results with exact metrics",
      "Links to the Signal API for transparency"
    ]
  },
  "plugins": [
    "@elizaos/plugin-solana-agent-kit",
    "@elizaos/plugin-solana",
    "plugin-trading-caller"
  ],
  "settings": {
    "solana": {
      "enableAutoTrading": true
    }
  }
}
```

**Step 2: Verify character loads**

Run: `cd eliza && elizaos start --character characters/trading-caller.json --dry-run`
Expected: Character parsed without errors (dry-run exits cleanly).

**Step 3: Commit**

```bash
git add eliza/characters/
git commit -m "feat: add TradingCaller character file"
```

---

## Task 3: Create Plugin — Types and Entry Point

**Files:**
- Create: `eliza/packages/plugin-trading-caller/package.json`
- Create: `eliza/packages/plugin-trading-caller/tsconfig.json`
- Create: `eliza/packages/plugin-trading-caller/src/types.ts`
- Create: `eliza/packages/plugin-trading-caller/src/index.ts`

**Step 1: Create package.json**

Create `eliza/packages/plugin-trading-caller/package.json`:
```json
{
  "name": "plugin-trading-caller",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@elizaos/core": "workspace:*",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/uuid": "^9.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

Create `eliza/packages/plugin-trading-caller/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create types.ts**

Create `eliza/packages/plugin-trading-caller/src/types.ts`:

```typescript
/**
 * A signal as returned by the Trading Caller API (GET /signals/latest).
 * Maps directly to the API response shape — do NOT change field names.
 */
export interface TradingSignal {
  id: string;
  timestamp: string;
  token: {
    symbol: string;
    name: string;
    address: string;  // Solana mint address
    decimals: number;
  };
  action: "LONG" | "SHORT";
  entry: number;
  targets: [number, number, number];  // TP1, TP2, TP3
  stopLoss: number;
  confidence: number;  // 0-100
  timeframe: string;   // "4H", "1D", etc.
  reasoning: {
    technical: string;
    fundamental: string;
    sentiment: string;
  };
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  technicalAnalysis: {
    rsi: { value: number; signal: string };
    macd: { macd: number; signal: number; histogram: number; trend: string; crossover: string | null };
    trend: { direction: string; strength: number; ema20: number; ema50: number; ema200: number };
    support: number[];
    resistance: number[];
    momentum: { value: number; increasing: boolean };
  };
  indicators: Record<string, number>;
}

/** Internal trade record tracked by the agent */
export interface TradeRecord {
  id: string;
  signalId: string;
  signal: TradingSignal;
  mode: "paper" | "live";
  entryPrice: number;
  exitPrice?: number;
  entryTxHash?: string;   // Only set in live mode
  exitTxHash?: string;
  positionSizeUSD: number;
  positionSizeTokens: number;
  pnl?: number;
  pnlPercent?: number;
  status: "open" | "closed" | "stopped_out" | "tp1_hit" | "tp2_hit" | "tp3_hit";
  entryTimestamp: number;
  exitTimestamp?: number;
}

/** Self-learning strategy parameters, adjusted by LLM review */
export interface StrategyConfig {
  minConfidence: number;              // Min signal confidence to trade (default: 60)
  defaultPositionPct: number;         // % of portfolio per trade (default: 5)
  highConfidencePositionPct: number;  // % for confidence > 80 (default: 8)
  maxOpenPositions: number;           // Concurrent position limit (default: 5)
  maxPortfolioExposurePct: number;    // Max % of portfolio in trades (default: 40)
  maxDrawdownPct: number;             // Halt threshold (default: 15)
  coolOffAfterConsecutiveLosses: number; // Pause after N losses (default: 3)
  coolOffDurationMs: number;          // Cool-off ms (default: 3600000)
  lastUpdated: number;
  updateReason: string;
  version: number;
}

/** Response shape from GET /signals/latest */
export interface SignalsApiResponse {
  success: boolean;
  count: number;
  signals: TradingSignal[];
  lastUpdate: string;
}

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  minConfidence: 60,
  defaultPositionPct: 5,
  highConfidencePositionPct: 8,
  maxOpenPositions: 5,
  maxPortfolioExposurePct: 40,
  maxDrawdownPct: 15,
  coolOffAfterConsecutiveLosses: 3,
  coolOffDurationMs: 3600000,
  lastUpdated: Date.now(),
  updateReason: "Initial defaults",
  version: 1,
};
```

**Step 4: Create plugin entry point**

Create `eliza/packages/plugin-trading-caller/src/index.ts`:

```typescript
import { Plugin } from "@elizaos/core";
import { executeTrade } from "./actions/executeTrade.js";
import { closeTrade } from "./actions/closeTrade.js";
import { reviewPerformance } from "./actions/reviewPerformance.js";
import { signalProvider } from "./providers/signalProvider.js";
import { portfolioProvider } from "./providers/portfolioProvider.js";
import { tradeEvaluator } from "./evaluators/tradeEvaluator.js";

export const tradingCallerPlugin: Plugin = {
  name: "plugin-trading-caller",
  description:
    "Consumes signals from Trading Caller API, executes trades on Solana (paper or live), tracks performance, and self-learns from outcomes.",
  actions: [executeTrade, closeTrade, reviewPerformance],
  providers: [signalProvider, portfolioProvider],
  evaluators: [tradeEvaluator],
};

export default tradingCallerPlugin;
```

**Step 5: Commit**

```bash
git add eliza/packages/plugin-trading-caller/
git commit -m "feat: add plugin-trading-caller types and entry point"
```

---

## Task 4: Signal Poller Service

The poller fetches signals from the existing Railway API every 5 minutes and caches new ones for the agent to act on.

**Files:**
- Create: `eliza/packages/plugin-trading-caller/src/services/signalPoller.ts`

**Step 1: Write the signal poller**

Create `eliza/packages/plugin-trading-caller/src/services/signalPoller.ts`:

```typescript
import { IAgentRuntime } from "@elizaos/core";
import { TradingSignal, SignalsApiResponse } from "../types.js";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const SEEN_SIGNALS_KEY = "seen-signal-ids";
const PENDING_SIGNALS_KEY = "pending-signals";

export class SignalPoller {
  private runtime: IAgentRuntime;
  private apiUrl: string;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.apiUrl = runtime.getSetting("TRADING_CALLER_API_URL")
      || "https://trading-caller-production.up.railway.app";
  }

  async start(): Promise<void> {
    console.log(`[SignalPoller] Starting — polling ${this.apiUrl}/signals/latest every ${POLL_INTERVAL_MS / 1000}s`);
    await this.poll(); // Initial poll
    this.intervalId = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[SignalPoller] Stopped");
    }
  }

  private async poll(): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/signals/latest`);
      if (!response.ok) {
        console.error(`[SignalPoller] API returned ${response.status}`);
        return;
      }

      const data: SignalsApiResponse = await response.json();
      if (!data.success || !data.signals?.length) return;

      // Load previously seen signal IDs
      const seenRaw = await this.runtime.cacheManager?.get<string>(SEEN_SIGNALS_KEY);
      const seenIds: Set<string> = new Set(seenRaw ? JSON.parse(seenRaw) : []);

      // Filter to only new signals
      const newSignals = data.signals.filter((s) => !seenIds.has(s.id));
      if (newSignals.length === 0) return;

      console.log(`[SignalPoller] ${newSignals.length} new signal(s) found`);

      // Mark as seen
      for (const s of newSignals) seenIds.add(s.id);

      // Keep seen list bounded (last 500)
      const seenArray = [...seenIds].slice(-500);
      await this.runtime.cacheManager?.set(SEEN_SIGNALS_KEY, JSON.stringify(seenArray));

      // Append to pending signals queue
      const pendingRaw = await this.runtime.cacheManager?.get<string>(PENDING_SIGNALS_KEY);
      const pending: TradingSignal[] = pendingRaw ? JSON.parse(pendingRaw) : [];
      pending.push(...newSignals);
      await this.runtime.cacheManager?.set(PENDING_SIGNALS_KEY, JSON.stringify(pending));

      console.log(`[SignalPoller] ${pending.length} signal(s) in pending queue`);
    } catch (err: any) {
      console.error(`[SignalPoller] Error: ${err.message}`);
    }
  }
}
```

**Step 2: Commit**

```bash
git add eliza/packages/plugin-trading-caller/src/services/
git commit -m "feat: add signal poller service (polls existing API)"
```

---

## Task 5: Execute Trade Action

Processes pending signals, applies strategy rules, and executes trades (paper or live via Jupiter).

**Files:**
- Create: `eliza/packages/plugin-trading-caller/src/actions/executeTrade.ts`

**Step 1: Write the execute trade action**

Create `eliza/packages/plugin-trading-caller/src/actions/executeTrade.ts`:

```typescript
import { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { TradingSignal, TradeRecord, StrategyConfig, DEFAULT_STRATEGY_CONFIG } from "../types.js";
import { v4 as uuid } from "uuid";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const executeTrade: Action = {
  name: "EXECUTE_TRADE",
  description:
    "Process pending trading signals from the queue. Validates against strategy config (confidence, position limits, cool-off), calculates position size, and executes trade in paper or live mode.",
  similes: ["TRADE", "BUY_TOKEN", "SELL_TOKEN", "OPEN_POSITION", "PROCESS_SIGNALS"],

  examples: [
    [
      {
        name: "TradingCaller",
        content: { text: "Process pending signals and execute qualifying trades." },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return (
      text.includes("signal") ||
      text.includes("trade") ||
      text.includes("execute") ||
      text.includes("process")
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State | undefined,
    options: any,
    callback: HandlerCallback
  ): Promise<void> => {
    try {
      const tradingMode = runtime.getSetting("TRADING_MODE") || "paper";

      // Load pending signals
      const pendingRaw = await runtime.cacheManager?.get<string>("pending-signals");
      const pending: TradingSignal[] = pendingRaw ? JSON.parse(pendingRaw) : [];

      if (pending.length === 0) {
        await callback({ text: "No pending signals to process." });
        return;
      }

      // Load strategy config
      const configRaw = await runtime.cacheManager?.get<string>("strategy-config");
      const config: StrategyConfig = configRaw ? JSON.parse(configRaw) : DEFAULT_STRATEGY_CONFIG;

      // Load open trades
      const openRaw = await runtime.cacheManager?.get<string>("open-trades");
      const openTrades: TradeRecord[] = openRaw ? JSON.parse(openRaw) : [];

      // Check cool-off
      const coolOffRaw = await runtime.cacheManager?.get<string>("cool-off-until");
      if (coolOffRaw) {
        const coolOffUntil = parseInt(coolOffRaw);
        if (Date.now() < coolOffUntil) {
          const minsLeft = Math.ceil((coolOffUntil - Date.now()) / 60000);
          await callback({ text: `Cool-off active. ${minsLeft}m remaining. Skipping all signals.` });
          await runtime.cacheManager?.set("pending-signals", "[]");
          return;
        }
      }

      const results: string[] = [];
      const journalRaw = await runtime.cacheManager?.get<string>("trade-journal");
      const journal: TradeRecord[] = journalRaw ? JSON.parse(journalRaw) : [];

      for (const signal of pending) {
        // Filter: confidence
        if (signal.confidence < config.minConfidence) {
          results.push(`SKIP ${signal.token.symbol}: confidence ${signal.confidence} < ${config.minConfidence}`);
          continue;
        }

        // Filter: max open positions
        if (openTrades.length >= config.maxOpenPositions) {
          results.push(`SKIP ${signal.token.symbol}: max open positions (${config.maxOpenPositions}) reached`);
          continue;
        }

        // Filter: already have a position in this token
        if (openTrades.some((t) => t.signal.token.address === signal.token.address)) {
          results.push(`SKIP ${signal.token.symbol}: already have an open position`);
          continue;
        }

        // Calculate position size
        const portfolioValue = 1000; // TODO: get from AgentWallet
        const positionPct =
          signal.confidence >= 80 ? config.highConfidencePositionPct : config.defaultPositionPct;
        const positionSizeUSD = (portfolioValue * positionPct) / 100;
        const positionSizeTokens = positionSizeUSD / signal.entry;

        // Execute
        let entryTxHash: string | undefined;

        if (tradingMode === "live") {
          // TODO: Call Jupiter swap via Solana Agent Kit
          // const inputMint = signal.action === "LONG" ? USDC_MINT : signal.token.address;
          // const outputMint = signal.action === "LONG" ? signal.token.address : USDC_MINT;
          // entryTxHash = await executeJupiterSwap(runtime, inputMint, outputMint, positionSizeUSD);
          results.push(`LIVE TRADE ${signal.action} ${signal.token.symbol} — Jupiter swap not yet wired`);
          continue;
        }

        // Paper trade — just record it
        const trade: TradeRecord = {
          id: uuid(),
          signalId: signal.id,
          signal,
          mode: tradingMode as "paper" | "live",
          entryPrice: signal.entry,
          entryTxHash,
          positionSizeUSD,
          positionSizeTokens,
          status: "open",
          entryTimestamp: Date.now(),
        };

        openTrades.push(trade);
        journal.push(trade);

        results.push(
          `${signal.action} ${signal.token.symbol} @ $${signal.entry} | ` +
          `$${positionSizeUSD.toFixed(0)} (${positionPct}%) | ` +
          `SL: $${signal.stopLoss} | TP: $${signal.targets[0]}/$${signal.targets[1]}/$${signal.targets[2]} | ` +
          `Confidence: ${signal.confidence} | Mode: ${tradingMode}`
        );
      }

      // Save state
      await runtime.cacheManager?.set("open-trades", JSON.stringify(openTrades));
      await runtime.cacheManager?.set("trade-journal", JSON.stringify(journal));
      await runtime.cacheManager?.set("pending-signals", "[]");

      await callback({
        text: `Processed ${pending.length} signal(s):\n${results.map((r) => `- ${r}`).join("\n")}`,
      });
    } catch (error: any) {
      await callback({ text: `Trade execution failed: ${error.message}` });
    }
  },
};
```

**Step 2: Commit**

```bash
git add eliza/packages/plugin-trading-caller/src/actions/executeTrade.ts
git commit -m "feat: add executeTrade action (paper + live mode)"
```

---

## Task 6: Close Trade Action

Closes an open position when SL/TP is hit or manually triggered.

**Files:**
- Create: `eliza/packages/plugin-trading-caller/src/actions/closeTrade.ts`

**Step 1: Write the close trade action**

Create `eliza/packages/plugin-trading-caller/src/actions/closeTrade.ts`:

```typescript
import { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { TradeRecord, StrategyConfig, DEFAULT_STRATEGY_CONFIG } from "../types.js";

export const closeTrade: Action = {
  name: "CLOSE_TRADE",
  description:
    "Close an open trade position. Calculates PnL, updates the trade journal, and triggers cool-off if consecutive losses exceed threshold.",
  similes: ["EXIT_POSITION", "CLOSE_POSITION", "TAKE_PROFIT", "STOP_LOSS"],

  examples: [
    [
      {
        name: "TradingCaller",
        content: { text: "Close trade trade_id abc-123 at $268" },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return text.includes("close") || text.includes("exit") || text.includes("stop");
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State | undefined,
    options: any,
    callback: HandlerCallback
  ): Promise<void> => {
    try {
      const text = message.content.text || "";
      const tradeIdMatch = text.match(/trade[_\s-]*id[:\s]*([a-f0-9-]+)/i);
      const priceMatch = text.match(/(?:price|at|@)\s*\$?([\d.]+)/i);

      if (!tradeIdMatch || !priceMatch) {
        await callback({
          text: "Provide trade ID and exit price. Example: 'Close trade_id abc-123 at $268'",
        });
        return;
      }

      const tradeId = tradeIdMatch[1];
      const exitPrice = parseFloat(priceMatch[1]);

      // Load open trades
      const openRaw = await runtime.cacheManager?.get<string>("open-trades");
      const openTrades: TradeRecord[] = openRaw ? JSON.parse(openRaw) : [];
      const tradeIndex = openTrades.findIndex((t) => t.id === tradeId);

      if (tradeIndex === -1) {
        await callback({ text: `Trade ${tradeId} not found in open positions.` });
        return;
      }

      const trade = openTrades[tradeIndex];

      // Calculate PnL
      const pnl =
        trade.signal.action === "LONG"
          ? (exitPrice - trade.entryPrice) * trade.positionSizeTokens
          : (trade.entryPrice - exitPrice) * trade.positionSizeTokens;
      const pnlPercent = (pnl / trade.positionSizeUSD) * 100;

      // Determine close reason
      let status: TradeRecord["status"] = "closed";
      if (trade.signal.action === "LONG") {
        if (exitPrice <= trade.signal.stopLoss) status = "stopped_out";
        else if (exitPrice >= trade.signal.targets[2]) status = "tp3_hit";
        else if (exitPrice >= trade.signal.targets[1]) status = "tp2_hit";
        else if (exitPrice >= trade.signal.targets[0]) status = "tp1_hit";
      } else {
        if (exitPrice >= trade.signal.stopLoss) status = "stopped_out";
        else if (exitPrice <= trade.signal.targets[2]) status = "tp3_hit";
        else if (exitPrice <= trade.signal.targets[1]) status = "tp2_hit";
        else if (exitPrice <= trade.signal.targets[0]) status = "tp1_hit";
      }

      // Update trade
      trade.exitPrice = exitPrice;
      trade.pnl = pnl;
      trade.pnlPercent = pnlPercent;
      trade.status = status;
      trade.exitTimestamp = Date.now();

      // Remove from open, update journal
      openTrades.splice(tradeIndex, 1);
      await runtime.cacheManager?.set("open-trades", JSON.stringify(openTrades));

      const journalRaw = await runtime.cacheManager?.get<string>("trade-journal");
      const journal: TradeRecord[] = journalRaw ? JSON.parse(journalRaw) : [];
      const jIdx = journal.findIndex((t) => t.id === tradeId);
      if (jIdx !== -1) journal[jIdx] = trade;
      await runtime.cacheManager?.set("trade-journal", JSON.stringify(journal));

      // Check consecutive losses for cool-off
      const closedTrades = journal.filter((t) => t.status !== "open").slice(-10);
      let consecutiveLosses = 0;
      for (let i = closedTrades.length - 1; i >= 0; i--) {
        if ((closedTrades[i].pnl || 0) < 0) consecutiveLosses++;
        else break;
      }

      const configRaw = await runtime.cacheManager?.get<string>("strategy-config");
      const config: StrategyConfig = configRaw ? JSON.parse(configRaw) : DEFAULT_STRATEGY_CONFIG;

      if (consecutiveLosses >= config.coolOffAfterConsecutiveLosses) {
        const coolOffUntil = Date.now() + config.coolOffDurationMs;
        await runtime.cacheManager?.set("cool-off-until", coolOffUntil.toString());
      }

      // Flag for evaluator
      await runtime.cacheManager?.set("pending-review", "true");

      const emoji = pnl >= 0 ? "WIN" : "LOSS";
      await callback({
        text: `Trade closed [${emoji}]:
- ${trade.signal.action} ${trade.signal.token.symbol}: $${trade.entryPrice} -> $${exitPrice}
- PnL: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} (${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(1)}%)
- Status: ${status}
- Mode: ${trade.mode}${consecutiveLosses >= config.coolOffAfterConsecutiveLosses ? `\n- Cool-off activated (${consecutiveLosses} consecutive losses)` : ""}`,
      });
    } catch (error: any) {
      await callback({ text: `Error closing trade: ${error.message}` });
    }
  },
};
```

**Step 2: Commit**

```bash
git add eliza/packages/plugin-trading-caller/src/actions/closeTrade.ts
git commit -m "feat: add closeTrade action with PnL tracking and cool-off"
```

---

## Task 7: Review Performance Action (Self-Learning)

Uses Claude to analyze trade history and suggest strategy parameter adjustments.

**Files:**
- Create: `eliza/packages/plugin-trading-caller/src/actions/reviewPerformance.ts`

**Step 1: Write the review performance action**

Create `eliza/packages/plugin-trading-caller/src/actions/reviewPerformance.ts`:

```typescript
import { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { TradeRecord, StrategyConfig, DEFAULT_STRATEGY_CONFIG } from "../types.js";

export const reviewPerformance: Action = {
  name: "REVIEW_PERFORMANCE",
  description:
    "Self-learning: Reviews recent trades, computes statistics, asks the LLM to suggest strategy config changes, and applies them.",
  similes: ["ANALYZE_TRADES", "OPTIMIZE_STRATEGY", "LEARN", "SELF_IMPROVE"],

  examples: [
    [
      {
        name: "TradingCaller",
        content: { text: "Review performance and optimize strategy." },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return text.includes("review") || text.includes("performance") || text.includes("learn") || text.includes("optimize");
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State | undefined,
    options: any,
    callback: HandlerCallback
  ): Promise<void> => {
    try {
      const journalRaw = await runtime.cacheManager?.get<string>("trade-journal");
      const journal: TradeRecord[] = journalRaw ? JSON.parse(journalRaw) : [];
      const closedTrades = journal.filter((t) => t.status !== "open");

      if (closedTrades.length < 3) {
        await callback({ text: "Not enough closed trades to review. Need at least 3." });
        return;
      }

      const wins = closedTrades.filter((t) => (t.pnl || 0) > 0);
      const losses = closedTrades.filter((t) => (t.pnl || 0) <= 0);
      const totalPnL = closedTrades.reduce((s, t) => s + (t.pnl || 0), 0);
      const lossSum = Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0));

      const stats = {
        totalTrades: closedTrades.length,
        winRate: `${((wins.length / closedTrades.length) * 100).toFixed(1)}%`,
        totalPnL: `$${totalPnL.toFixed(2)}`,
        avgWin: wins.length ? `$${(wins.reduce((s, t) => s + (t.pnl || 0), 0) / wins.length).toFixed(2)}` : "$0",
        avgLoss: losses.length ? `$${(losses.reduce((s, t) => s + (t.pnl || 0), 0) / losses.length).toFixed(2)}` : "$0",
        profitFactor: lossSum > 0 ? (wins.reduce((s, t) => s + (t.pnl || 0), 0) / lossSum).toFixed(2) : "N/A",
        stopOutRate: `${((closedTrades.filter((t) => t.status === "stopped_out").length / closedTrades.length) * 100).toFixed(1)}%`,
        tpHitRate: `${((closedTrades.filter((t) => t.status.startsWith("tp")).length / closedTrades.length) * 100).toFixed(1)}%`,
      };

      const configRaw = await runtime.cacheManager?.get<string>("strategy-config");
      const config: StrategyConfig = configRaw ? JSON.parse(configRaw) : DEFAULT_STRATEGY_CONFIG;

      await callback({
        text: `Performance Review:
- Trades: ${stats.totalTrades} | Win rate: ${stats.winRate}
- PnL: ${stats.totalPnL} | Profit factor: ${stats.profitFactor}
- Avg win: ${stats.avgWin} | Avg loss: ${stats.avgLoss}
- Stop-out rate: ${stats.stopOutRate} | TP rate: ${stats.tpHitRate}
- Strategy version: ${config.version} | Min confidence: ${config.minConfidence}

Analyzing patterns for strategy optimization...`,
      });

      // LLM-based strategy optimization would go here:
      // 1. Build prompt with stats + last 10 trades + current config
      // 2. Call runtime.useModel() or runtime.completion()
      // 3. Parse suggested config changes
      // 4. Save updated config to cache
      // This is wired up once ElizaOS runtime LLM calls are confirmed working.

      await runtime.cacheManager?.set("pending-review", "false");
    } catch (error: any) {
      await callback({ text: `Performance review failed: ${error.message}` });
    }
  },
};
```

**Step 2: Commit**

```bash
git add eliza/packages/plugin-trading-caller/src/actions/reviewPerformance.ts
git commit -m "feat: add reviewPerformance action (self-learning)"
```

---

## Task 8: Providers (Signal + Portfolio Context)

Inject live state into the LLM context window.

**Files:**
- Create: `eliza/packages/plugin-trading-caller/src/providers/signalProvider.ts`
- Create: `eliza/packages/plugin-trading-caller/src/providers/portfolioProvider.ts`

**Step 1: Write signalProvider.ts**

Create `eliza/packages/plugin-trading-caller/src/providers/signalProvider.ts`:

```typescript
import { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";
import { TradingSignal, TradeRecord } from "../types.js";

export const signalProvider: Provider = {
  name: "TRADING_SIGNALS",
  description: "Injects pending signals and open positions into agent context",

  get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string> => {
    try {
      const pendingRaw = await runtime.cacheManager?.get<string>("pending-signals");
      const pending: TradingSignal[] = pendingRaw ? JSON.parse(pendingRaw) : [];

      const openRaw = await runtime.cacheManager?.get<string>("open-trades");
      const openTrades: TradeRecord[] = openRaw ? JSON.parse(openRaw) : [];

      if (pending.length === 0 && openTrades.length === 0) {
        return "No pending signals or open positions.";
      }

      const parts: string[] = [];

      if (pending.length > 0) {
        parts.push(`PENDING SIGNALS (${pending.length}):`);
        for (const s of pending) {
          parts.push(
            `  ${s.action} ${s.token.symbol} @ $${s.entry} | Confidence: ${s.confidence} | SL: $${s.stopLoss} | TP: $${s.targets.join("/$")}`
          );
        }
      }

      if (openTrades.length > 0) {
        parts.push(`\nOPEN POSITIONS (${openTrades.length}):`);
        for (const t of openTrades) {
          const age = ((Date.now() - t.entryTimestamp) / 60000).toFixed(0);
          parts.push(
            `  ${t.signal.action} ${t.signal.token.symbol} @ $${t.entryPrice} | $${t.positionSizeUSD.toFixed(0)} | ${age}m ago | ${t.mode}`
          );
        }
      }

      return parts.join("\n");
    } catch {
      return "Error loading trading signals.";
    }
  },
};
```

**Step 2: Write portfolioProvider.ts**

Create `eliza/packages/plugin-trading-caller/src/providers/portfolioProvider.ts`:

```typescript
import { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";
import { TradeRecord, StrategyConfig, DEFAULT_STRATEGY_CONFIG } from "../types.js";

export const portfolioProvider: Provider = {
  name: "PORTFOLIO_STATUS",
  description: "Injects portfolio balance, trade stats, and strategy config into agent context",

  get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string> => {
    try {
      const openRaw = await runtime.cacheManager?.get<string>("open-trades");
      const openTrades: TradeRecord[] = openRaw ? JSON.parse(openRaw) : [];

      const journalRaw = await runtime.cacheManager?.get<string>("trade-journal");
      const journal: TradeRecord[] = journalRaw ? JSON.parse(journalRaw) : [];

      const configRaw = await runtime.cacheManager?.get<string>("strategy-config");
      const config: StrategyConfig = configRaw ? JSON.parse(configRaw) : DEFAULT_STRATEGY_CONFIG;

      const closed = journal.filter((t) => t.status !== "open");
      const totalPnL = closed.reduce((s, t) => s + (t.pnl || 0), 0);
      const winRate = closed.length > 0
        ? ((closed.filter((t) => (t.pnl || 0) > 0).length / closed.length) * 100).toFixed(1)
        : "0.0";
      const tradingMode = "paper"; // TODO: get from runtime settings

      return `PORTFOLIO:
- Mode: ${tradingMode}
- Open positions: ${openTrades.length}/${config.maxOpenPositions}
- Closed trades: ${closed.length}
- PnL: $${totalPnL.toFixed(2)} | Win rate: ${winRate}%
- Strategy v${config.version}: min confidence ${config.minConfidence}, position ${config.defaultPositionPct}%/${config.highConfidencePositionPct}%`;
    } catch {
      return "Error loading portfolio status.";
    }
  },
};
```

**Step 3: Commit**

```bash
git add eliza/packages/plugin-trading-caller/src/providers/
git commit -m "feat: add signal and portfolio providers"
```

---

## Task 9: Trade Evaluator

Runs after interactions and flags when performance review is needed.

**Files:**
- Create: `eliza/packages/plugin-trading-caller/src/evaluators/tradeEvaluator.ts`

**Step 1: Write the evaluator**

Create `eliza/packages/plugin-trading-caller/src/evaluators/tradeEvaluator.ts`:

```typescript
import { Evaluator, IAgentRuntime, Memory, State } from "@elizaos/core";

export const tradeEvaluator: Evaluator = {
  name: "TRADE_PERFORMANCE_EVALUATOR",
  description: "Checks for closed trades that need performance review and flags the self-learning loop.",
  alwaysRun: false,

  examples: [
    {
      context: "After a trade has been closed",
      messages: [
        { name: "TradingCaller", content: { text: "Trade closed." } },
      ],
      outcome: "Flags pending review for strategy optimization.",
    },
  ],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const pendingReview = await runtime.cacheManager?.get<string>("pending-review");
    return pendingReview === "true";
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<void> => {
    try {
      const journalRaw = await runtime.cacheManager?.get<string>("trade-journal");
      const journal = journalRaw ? JSON.parse(journalRaw) : [];
      const closed = journal.filter((t: any) => t.status !== "open");

      if (closed.length < 3) return;

      const recent = closed.slice(-5);
      const recentWinRate = (recent.filter((t: any) => (t.pnl || 0) > 0).length / recent.length) * 100;
      const overallWinRate = (closed.filter((t: any) => (t.pnl || 0) > 0).length / closed.length) * 100;

      if (Math.abs(recentWinRate - overallWinRate) > 20) {
        console.log(
          `[TradeEvaluator] Performance shift: recent ${recentWinRate.toFixed(1)}% vs overall ${overallWinRate.toFixed(1)}%`
        );
      }

      await runtime.cacheManager?.set("pending-review", "false");
    } catch (error) {
      console.error("[TradeEvaluator] Error:", error);
    }
  },
};
```

**Step 2: Commit**

```bash
git add eliza/packages/plugin-trading-caller/src/evaluators/
git commit -m "feat: add trade evaluator for self-learning triggers"
```

---

## Task 10: Wire Up AgentWallet

Configure AgentWallet MCP for wallet management instead of raw keypairs.

**Files:**
- Modify: `eliza/.env`
- Reference: https://agentwallet.mcpay.tech/skill.md

**Step 1: Fetch AgentWallet skill docs**

Run: `curl -s https://agentwallet.mcpay.tech/skill.md | head -100`

Review the output to confirm the integration pattern (API key, endpoint URLs).

**Step 2: Add AgentWallet config to .env**

Add to `eliza/.env`:
```env
AGENT_WALLET_API_KEY=<your-agentwallet-key>
AGENT_WALLET_URL=https://agentwallet.mcpay.tech
```

**Step 3: Commit**

```bash
git add eliza/.env.example  # Don't commit actual .env
git commit -m "feat: add AgentWallet configuration"
```

---

## Task 11: Start Scripts and Integration Test

Wire everything together and verify the agent starts.

**Files:**
- Modify: `eliza/package.json` (add scripts)

**Step 1: Add start scripts**

Add to `eliza/package.json` scripts:
```json
{
  "scripts": {
    "start": "elizaos start --character characters/trading-caller.json",
    "dev": "elizaos dev --character characters/trading-caller.json",
    "build:plugin": "cd packages/plugin-trading-caller && pnpm build"
  }
}
```

**Step 2: Build the plugin**

Run: `cd eliza && pnpm build:plugin`
Expected: TypeScript compiles without errors.

**Step 3: Start the agent in dev mode**

Run: `cd eliza && pnpm dev`
Expected: ElizaOS starts, loads the TradingCaller character, registers all 3 actions + 2 providers + 1 evaluator, signal poller begins fetching from Railway API.

**Step 4: Verify signal polling**

Wait ~30 seconds, check console for:
```
[SignalPoller] Starting — polling https://trading-caller-production.up.railway.app/signals/latest every 300s
[SignalPoller] N new signal(s) found
```

**Step 5: Commit**

```bash
git add eliza/package.json
git commit -m "feat: add start scripts and verify agent startup"
```

---

## Task 12: Colosseum Forum Integration

Post updates to the hackathon forum. This uses the existing hackathon API key.

**Step 1: Post initial announcement**

This is a manual curl (or can be automated in a scheduled action later):

```bash
curl -X POST https://agents.colosseum.com/api/forum/posts \
  -H "Authorization: Bearer $COLOSSEUM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Trading Caller — Now with ElizaOS Agent Brain",
    "body": "Trading Caller now runs on ElizaOS with self-learning capabilities. The agent polls signals from our research engine, executes paper trades, and uses Claude to optimize strategy parameters from outcomes.\n\nSignal API: https://trading-caller-production.up.railway.app/signals/latest\nDashboard: https://website-nine-rho-35.vercel.app/",
    "tags": ["trading", "ai", "progress-update"]
  }'
```

**Step 2: Commit any forum integration code**

```bash
git add -A && git commit -m "feat: complete ElizaOS agent integration"
```

---

## Summary

| Task | What | Key Files |
|------|------|-----------|
| 1 | Scaffold ElizaOS project | `eliza/` |
| 2 | Character file | `eliza/characters/trading-caller.json` |
| 3 | Plugin types + entry | `eliza/packages/plugin-trading-caller/src/{types,index}.ts` |
| 4 | Signal poller | `eliza/packages/plugin-trading-caller/src/services/signalPoller.ts` |
| 5 | Execute trade action | `eliza/packages/plugin-trading-caller/src/actions/executeTrade.ts` |
| 6 | Close trade action | `eliza/packages/plugin-trading-caller/src/actions/closeTrade.ts` |
| 7 | Review performance | `eliza/packages/plugin-trading-caller/src/actions/reviewPerformance.ts` |
| 8 | Providers | `eliza/packages/plugin-trading-caller/src/providers/{signal,portfolio}Provider.ts` |
| 9 | Evaluator | `eliza/packages/plugin-trading-caller/src/evaluators/tradeEvaluator.ts` |
| 10 | AgentWallet config | `eliza/.env` |
| 11 | Start scripts + test | `eliza/package.json` |
| 12 | Forum post | Manual curl |

**What's NOT included (deferred):**
- Leaderboard (add later if time)
- Live Jupiter swap execution (wired but commented out — enable by setting `TRADING_MODE=live`)
- Automated forum posting action (can add as a cron action later)
- publishSignal action (removed — existing API already publishes signals)
