const BASE = "/api";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

// ---------- Signals ----------

export interface Signal {
  id: string;
  token: { symbol: string; address: string; name: string };
  action: "LONG" | "SHORT";
  confidence: number;
  entry: number;
  targets: number[];
  stopLoss: number;
  timeframe: string;
  timestamp: string;
  reasoning: { technical: string; summary?: string };
  indicators: { rsi: number; macd: number | string; volume: string };
}

export interface SignalsResponse {
  success: boolean;
  signals: Signal[];
  count: number;
}

export function getLatestSignals(action?: string) {
  const q = action ? `?action=${action}` : "";
  return fetchJson<SignalsResponse>(`/signals/latest${q}`);
}

// ---------- Performance ----------

export interface PerformanceData {
  success: boolean;
  performance: {
    totalSignals: number;
    outcomes: { win: number; loss: number; pending: number; breakeven: number };
    winRate: number;
    avgPnl: number;
    totalPnl: number;
    profitFactor: number;
    byAction: {
      LONG: { count: number; winRate: number; avgPnl: number };
      SHORT: { count: number; winRate: number; avgPnl: number };
    };
  };
}

export function getPerformance() {
  return fetchJson<PerformanceData>("/signals/performance");
}

// ---------- Positions ----------

export interface Position {
  id: string;
  token: { symbol: string; address: string };
  action: "LONG" | "SHORT";
  status: string;
  entry: number;
  current: number;
  targets: {
    tp1: number;
    tp2: number;
    tp3: number;
    hit: { tp1: boolean; tp2: boolean; tp3: boolean };
  };
  stopLoss: number;
  pnl: number;
  highestPnl: number;
  lowestPnl: number;
  timeInPosition: string;
  openedAt: string;
  confidence: number;
  timeframe: string;
}

export interface PositionStats {
  success: boolean;
  stats: {
    totalOpen: number;
    totalClosed: number;
    winRate: number;
    avgPnl: number;
    totalPnl: number;
    bestTrade: { symbol: string; pnl: number } | null;
    worstTrade: { symbol: string; pnl: number } | null;
  };
}

export function getPositionStats() {
  return fetchJson<PositionStats>("/positions/stats");
}

export function getOpenPositions() {
  return fetchJson<{ success: boolean; positions: Position[] }>(
    "/positions/open"
  );
}

// ---------- RSI Scanner ----------

export interface RsiToken {
  symbol: string;
  name: string;
  rsi: number;
  price: number;
  priceChange24h: number;
  signal: number;
  lastUpdated: string;
}

export interface RsiMultiResponse {
  success: boolean;
  data: {
    tokens: Record<
      string,
      {
        symbol: string;
        name: string;
        rsi_14: { current: number };
        price: { current: number; change_24h: number };
        signal: string;
        lastUpdated: string;
      }
    >;
  };
  tokensScanned?: number;
}

export function getRsiMulti() {
  return fetchJson<RsiMultiResponse>("/rsi/multi");
}

export function triggerRsiScan() {
  return fetchJson<{ success: boolean }>("/rsi/multi/scan", {
    method: "POST",
  });
}

export function getOversoldTokens() {
  return fetchJson<{ success: boolean; tokens: RsiToken[] }>("/rsi/oversold");
}

export function getOverboughtTokens() {
  return fetchJson<{ success: boolean; tokens: RsiToken[] }>("/rsi/overbought");
}

// ---------- Volume ----------

export interface VolumeToken {
  symbol: string;
  name: string;
  volume24h: number;
  volumeChange: number;
  price: number;
  priceChange24h: number;
}

export interface VolumeSpike {
  symbol: string;
  name: string;
  severity: "low" | "medium" | "high" | "extreme";
  volumeMultiplier: number;
  price: number;
  priceChange: number;
  detectedAt: string;
}

export function getTopVolume() {
  return fetchJson<{ success: boolean; tokens: VolumeToken[] }>("/volume/top");
}

export function getVolumeSpikes() {
  return fetchJson<{ success: boolean; spikes: VolumeSpike[] }>(
    "/volume/spikes"
  );
}

// ---------- Leaderboard ----------

export interface LeaderboardEntry {
  symbol: string;
  name: string;
  totalSignals: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  rank: number;
}

export function getLeaderboard() {
  return fetchJson<{ success: boolean; leaderboard: LeaderboardEntry[] }>(
    "/leaderboard"
  );
}

// ---------- Market ----------

export interface MarketOverview {
  success: boolean;
  overview: {
    sentiment: string;
    solPrice: number;
    solChange24h: number;
    totalSignals: number;
    longCount: number;
    shortCount: number;
    avgConfidence: number;
    topMover: { symbol: string; change: number } | null;
  };
}

export function getMarketOverview() {
  return fetchJson<MarketOverview>("/market/overview");
}

// ---------- Status ----------

export interface StatusResponse {
  success: boolean;
  status: string;
  uptime: number;
  version: string;
  engines: Record<string, { status: string }>;
}

export function getStatus() {
  return fetchJson<StatusResponse>("/status");
}

// ---------- Dashboard ----------

export function getDashboard() {
  return fetchJson<{ success: boolean; [key: string]: unknown }>("/dashboard");
}

// ---------- Backtest ----------

export interface BacktestResult {
  strategy: string;
  symbol: string;
  trades: number;
  winRate: number;
  totalPnl: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

export interface BacktestAnalysis {
  success: boolean;
  strategies: {
    name: string;
    winRate: number;
    avgPnl: number;
    totalTrades: number;
    profitFactor: number;
  }[];
}

export function getBacktestResults() {
  return fetchJson<{ success: boolean; results: BacktestResult[] }>(
    "/backtest/results"
  );
}

export function getBacktestStrategies() {
  return fetchJson<BacktestAnalysis>("/backtest/analysis/strategies");
}
