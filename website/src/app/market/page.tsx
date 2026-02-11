"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, timeAgo, rsiColor, rsiBgColor } from "@/lib/utils";
import {
  Activity,
  Search,
  ArrowUpDown,
  TrendingDown,
  TrendingUp,
  Zap,
  Loader2,
} from "lucide-react";

/* ---------- Types ---------- */

interface RsiTimeframes {
  "1h"?: number;
  "4h"?: number;
  "1d"?: number;
  "1w"?: number;
}

interface TokenData {
  symbol: string;
  name: string;
  id: string;
  image?: string;
  price: number;
  priceChange24h: number;
  volume24h?: number;
  marketCap?: number;
  rsi: RsiTimeframes;
  signal: string;
  strength?: string;
  lastUpdated?: string;
}

interface ScanProgress {
  total: number;
  withRSI: number;
  scanning: boolean;
  currentBatch?: number;
  totalBatches?: number;
  scannedTokens?: string[];
}

interface RsiMultiResponse {
  success: boolean;
  lastUpdated?: string;
  scanProgress?: ScanProgress;
  tokens: TokenData[];
}

type SortDirection = "asc" | "desc";

/* ---------- Constants ---------- */

const POLL_INTERVAL_MS = 60_000;
const RSI_OVERSOLD_THRESHOLD = 30;
const RSI_OVERBOUGHT_THRESHOLD = 70;
const SKELETON_ROW_COUNT = 8;
const PRIMARY_TIMEFRAME = "4h" as const;

/* ---------- Helpers ---------- */

/** Extract the primary (4h) RSI value, defaulting to 50 when unavailable. */
function getPrimaryRsi(token: TokenData): number {
  return token.rsi?.[PRIMARY_TIMEFRAME] ?? 50;
}

/* ---------- Page Component ---------- */

export default function MarketPage() {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/rsi/multi");
      if (!res.ok) throw new Error(`API ${res.status}`);

      const data: RsiMultiResponse = await res.json();

      if (data.success && Array.isArray(data.tokens)) {
        setTokens(data.tokens);
        setLastUpdated(data.lastUpdated ?? null);
        setScanProgress(data.scanProgress ?? null);
      }
    } catch {
      /* Silently fail on poll -- keep stale data visible */
    } finally {
      setLoading(false);
    }
  }, []);

  /* Initial fetch + poll every 60s */
  useEffect(() => {
    fetchTokens();

    const interval = setInterval(fetchTokens, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchTokens]);

  /* ---------- Scan Now ---------- */

  async function handleScanNow() {
    setScanning(true);
    try {
      const res = await fetch("/api/rsi/multi/scan", { method: "POST" });
      if (res.ok) {
        /* Re-fetch data after scan completes */
        await fetchTokens();
      }
    } catch {
      /* Scan failed -- data will refresh on next poll */
    } finally {
      setScanning(false);
    }
  }

  /* ---------- Derived data ---------- */

  const filteredAndSorted = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    const filtered = query
      ? tokens.filter(
          (t) =>
            t.symbol?.toLowerCase().includes(query) ||
            t.name?.toLowerCase().includes(query)
        )
      : tokens;

    return [...filtered].sort((a, b) => {
      const aRsi = getPrimaryRsi(a);
      const bRsi = getPrimaryRsi(b);
      return sortDirection === "asc" ? aRsi - bRsi : bRsi - aRsi;
    });
  }, [tokens, searchQuery, sortDirection]);

  const oversoldCount = useMemo(
    () =>
      tokens.filter(
        (t) =>
          getPrimaryRsi(t) < RSI_OVERSOLD_THRESHOLD ||
          t.signal?.toUpperCase() === "OVERSOLD"
      ).length,
    [tokens]
  );

  const overboughtCount = useMemo(
    () =>
      tokens.filter(
        (t) =>
          getPrimaryRsi(t) > RSI_OVERBOUGHT_THRESHOLD ||
          t.signal?.toUpperCase() === "OVERBOUGHT"
      ).length,
    [tokens]
  );

  const tokensScannedCount = scanProgress?.total ?? tokens.length;

  /* ---------- Toggle sort ---------- */

  function toggleSort() {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  }

  /* ---------- Loading skeleton ---------- */

  if (loading) {
    return <MarketSkeleton />;
  }

  /* ---------- Render ---------- */

  return (
    <div className="flex flex-col gap-6 py-8 md:py-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-text-primary md:text-4xl">
              RSI Scanner
            </h1>
            <Badge variant="cyan">
              <Activity className="mr-1 h-3 w-3" />
              Live
            </Badge>
          </div>
          <p className="text-text-secondary">
            Real-time RSI analysis across {tokensScannedCount} Solana tokens
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-text-muted">
              Updated {timeAgo(lastUpdated)}
            </span>
          )}
          <button
            type="button"
            onClick={handleScanNow}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple/20 px-4 py-2 text-sm font-semibold text-brand-purple-light transition-colors hover:bg-brand-purple/30 disabled:opacity-50"
          >
            <Zap
              className={`h-3.5 w-3.5 ${scanning ? "animate-pulse" : ""}`}
            />
            {scanning ? "Scanning..." : "Scan Now"}
          </button>
        </div>
      </div>

      {/* Scan progress bar */}
      {scanProgress?.scanning && (
        <ScanProgressBar progress={scanProgress} />
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={Activity}
          label="Tokens Scanned"
          value={String(scanProgress?.withRSI ?? tokens.length)}
          subtitle={`of ${tokensScannedCount}`}
          accentBg="bg-brand-purple/15"
          accentText="text-brand-purple-light"
        />
        <SummaryCard
          icon={TrendingDown}
          label="Oversold"
          value={String(oversoldCount)}
          subtitle="RSI < 30"
          accentBg="bg-long-green-dim"
          accentText="text-long-green"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Overbought"
          value={String(overboughtCount)}
          subtitle="RSI > 70"
          accentBg="bg-short-red-dim"
          accentText="text-short-red"
        />
      </div>

      {/* Search + Sort controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search tokens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border-default bg-bg-surface py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-purple/50 focus:outline-none focus:ring-1 focus:ring-brand-purple/30"
          />
        </div>

        {/* Sort toggle + result count */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">
            {filteredAndSorted.length} token
            {filteredAndSorted.length !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={toggleSort}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-elevated px-3 py-1.5 text-xs font-semibold text-text-primary transition-colors hover:bg-bg-hover"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            RSI {sortDirection === "asc" ? "Low to High" : "High to Low"}
          </button>
        </div>
      </div>

      {/* Token list */}
      {filteredAndSorted.length === 0 ? (
        <EmptyState hasSearch={searchQuery.length > 0} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <TokenTable
              tokens={filteredAndSorted}
              sortDirection={sortDirection}
              onToggleSort={toggleSort}
            />
          </div>

          {/* Mobile card grid */}
          <div className="flex flex-col gap-3 md:hidden">
            {filteredAndSorted.map((token) => (
              <TokenMobileCard key={token.symbol} token={token} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ================================================================
   Sub-components
   ================================================================ */

/* ---------- Scan Progress Bar ---------- */

function ScanProgressBar({ progress }: { progress: ScanProgress }) {
  const percentage =
    progress.totalBatches && progress.totalBatches > 0
      ? Math.round(
          ((progress.currentBatch ?? 0) / progress.totalBatches) * 100
        )
      : 0;

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-cyan" />
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-text-secondary">
              Scanning batch {progress.currentBatch ?? 0} of{" "}
              {progress.totalBatches ?? "?"}
            </span>
            <span className="tabular-nums text-text-muted">
              {progress.withRSI} / {progress.total} tokens with RSI
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
            <div
              className="h-full rounded-full bg-brand-cyan transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Summary Card ---------- */

function SummaryCard({
  icon: Icon,
  label,
  value,
  subtitle,
  accentBg,
  accentText,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtitle?: string;
  accentBg: string;
  accentText: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${accentBg}`}
        >
          <Icon className={`h-5 w-5 ${accentText}`} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-text-muted">{label}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-text-primary">
              {value}
            </span>
            {subtitle && (
              <span className="text-xs text-text-muted">{subtitle}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Desktop Token Table ---------- */

function TokenTable({
  tokens,
  sortDirection,
  onToggleSort,
}: {
  tokens: TokenData[];
  sortDirection: SortDirection;
  onToggleSort: () => void;
}) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default">
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                Token
              </th>
              <th className="px-5 py-3.5 text-left">
                <button
                  type="button"
                  onClick={onToggleSort}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted transition-colors hover:text-text-primary"
                >
                  RSI (4h)
                  <ArrowUpDown className="h-3 w-3" />
                  <span className="text-[10px] normal-case font-normal">
                    ({sortDirection === "asc" ? "low first" : "high first"})
                  </span>
                </button>
              </th>
              <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-text-muted">
                1h
              </th>
              <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-text-muted">
                1d
              </th>
              <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-text-muted">
                1w
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                Price
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                24h Change
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                Signal
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                Updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {tokens.map((token) => (
              <TokenTableRow key={token.symbol} token={token} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------- Token Table Row ---------- */

function TokenTableRow({ token }: { token: TokenData }) {
  const rsi4h = token.rsi?.["4h"] ?? 0;
  const rsi1h = token.rsi?.["1h"];
  const rsi1d = token.rsi?.["1d"];
  const rsi1w = token.rsi?.["1w"];
  const price = token.price ?? 0;
  const change24h = token.priceChange24h ?? 0;
  const isPositiveChange = change24h >= 0;

  return (
    <tr className="transition-colors hover:bg-bg-hover/50">
      {/* Token identity */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          {token.image ? (
            <img
              src={token.image}
              alt={token.symbol}
              className="h-9 w-9 shrink-0 rounded-lg"
              loading="lazy"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-elevated">
              <span className="text-xs font-bold text-text-secondary">
                {token.symbol?.slice(0, 2)}
              </span>
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-text-primary">
              {token.symbol}
            </span>
            <span className="max-w-[160px] truncate text-xs text-text-muted">
              {token.name}
            </span>
          </div>
        </div>
      </td>

      {/* Primary RSI (4h) pill */}
      <td className="px-5 py-3.5">
        <RsiPill rsi={rsi4h} />
      </td>

      {/* 1h RSI */}
      <td className="px-5 py-3.5 text-center">
        <RsiMini value={rsi1h} />
      </td>

      {/* 1d RSI */}
      <td className="px-5 py-3.5 text-center">
        <RsiMini value={rsi1d} />
      </td>

      {/* 1w RSI */}
      <td className="px-5 py-3.5 text-center">
        <RsiMini value={rsi1w} />
      </td>

      {/* Price */}
      <td className="px-5 py-3.5 text-right">
        <span className="text-sm font-semibold tabular-nums text-text-primary">
          ${formatPrice(price)}
        </span>
      </td>

      {/* 24h change */}
      <td className="px-5 py-3.5 text-right">
        <span
          className={`inline-flex items-center gap-1 text-sm font-semibold tabular-nums ${
            isPositiveChange ? "text-long-green" : "text-short-red"
          }`}
        >
          {isPositiveChange ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          {isPositiveChange ? "+" : ""}
          {change24h.toFixed(2)}%
        </span>
      </td>

      {/* Signal */}
      <td className="px-5 py-3.5">
        <SignalBadge signal={token.signal} strength={token.strength} />
      </td>

      {/* Last updated */}
      <td className="px-5 py-3.5 text-right">
        <span className="text-xs text-text-muted">
          {token.lastUpdated ? timeAgo(token.lastUpdated) : "--"}
        </span>
      </td>
    </tr>
  );
}

/* ---------- Mobile Token Card ---------- */

function TokenMobileCard({ token }: { token: TokenData }) {
  const rsi4h = token.rsi?.["4h"] ?? 0;
  const price = token.price ?? 0;
  const change24h = token.priceChange24h ?? 0;
  const isPositiveChange = change24h >= 0;

  return (
    <Card className="transition-colors hover:border-brand-purple/30">
      <CardContent className="flex flex-col gap-3 p-4">
        {/* Top row: token identity + RSI */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {token.image ? (
              <img
                src={token.image}
                alt={token.symbol}
                className="h-9 w-9 shrink-0 rounded-lg"
                loading="lazy"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-elevated">
                <span className="text-xs font-bold text-text-secondary">
                  {token.symbol?.slice(0, 2)}
                </span>
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-text-primary">
                {token.symbol}
              </span>
              <span className="max-w-[140px] truncate text-xs text-text-muted">
                {token.name}
              </span>
            </div>
          </div>
          <RsiPill rsi={rsi4h} />
        </div>

        {/* RSI timeframes row */}
        <div className="flex items-center justify-between rounded-lg bg-bg-elevated px-3 py-2">
          <RsiTimeframeLabel label="1h" value={token.rsi?.["1h"]} />
          <RsiTimeframeLabel label="4h" value={token.rsi?.["4h"]} />
          <RsiTimeframeLabel label="1d" value={token.rsi?.["1d"]} />
          <RsiTimeframeLabel label="1w" value={token.rsi?.["1w"]} />
        </div>

        {/* Bottom row: price, change, signal */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-text-muted">Price</span>
            <span className="text-sm font-semibold tabular-nums text-text-primary">
              ${formatPrice(price)}
            </span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs text-text-muted">24h</span>
            <span
              className={`inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums ${
                isPositiveChange ? "text-long-green" : "text-short-red"
              }`}
            >
              {isPositiveChange ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {isPositiveChange ? "+" : ""}
              {change24h.toFixed(2)}%
            </span>
          </div>

          <div className="flex flex-col items-end gap-0.5">
            <span className="text-xs text-text-muted">Signal</span>
            <SignalBadge signal={token.signal} strength={token.strength} />
          </div>
        </div>

        {/* Updated timestamp */}
        <div className="flex justify-end">
          <span className="text-[10px] text-text-muted">
            {token.lastUpdated ? timeAgo(token.lastUpdated) : "--"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- RSI Pill (primary 4h display) ---------- */

function RsiPill({ rsi }: { rsi: number }) {
  const displayRsi = rsi.toFixed(1);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-lg font-bold tabular-nums ${rsiColor(rsi)} ${rsiBgColor(rsi)}`}
    >
      {displayRsi}
    </span>
  );
}

/* ---------- RSI Mini (secondary timeframe in table) ---------- */

function RsiMini({ value }: { value?: number }) {
  if (value == null) {
    return <span className="text-xs text-text-muted">--</span>;
  }

  return (
    <span
      className={`text-sm font-semibold tabular-nums ${rsiColor(value)}`}
    >
      {value.toFixed(1)}
    </span>
  );
}

/* ---------- RSI Timeframe Label (mobile) ---------- */

function RsiTimeframeLabel({
  label,
  value,
}: {
  label: string;
  value?: number;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] font-medium uppercase text-text-muted">
        {label}
      </span>
      {value != null ? (
        <span
          className={`text-xs font-semibold tabular-nums ${rsiColor(value)}`}
        >
          {value.toFixed(1)}
        </span>
      ) : (
        <span className="text-xs text-text-muted">--</span>
      )}
    </div>
  );
}

/* ---------- Signal Badge ---------- */

function SignalBadge({
  signal,
  strength,
}: {
  signal: string;
  strength?: string;
}) {
  const normalized = signal?.toUpperCase() ?? "";
  const strengthLabel =
    strength && strength !== "moderate"
      ? ` (${strength})`
      : "";

  if (normalized.includes("OVERSOLD") || normalized.includes("BUY")) {
    return (
      <Badge variant="long">
        {signal}
        {strengthLabel}
      </Badge>
    );
  }
  if (normalized.includes("OVERBOUGHT") || normalized.includes("SELL")) {
    return (
      <Badge variant="short">
        {signal}
        {strengthLabel}
      </Badge>
    );
  }
  if (normalized.includes("NEUTRAL")) {
    return (
      <Badge variant="muted">
        {signal}
        {strengthLabel}
      </Badge>
    );
  }
  if (normalized.includes("BULLISH")) {
    return (
      <Badge variant="long">
        {signal}
        {strengthLabel}
      </Badge>
    );
  }
  if (normalized.includes("BEARISH")) {
    return (
      <Badge variant="short">
        {signal}
        {strengthLabel}
      </Badge>
    );
  }

  return <Badge variant="muted">{signal || "--"}</Badge>;
}

/* ---------- Empty State ---------- */

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <Card className="border-border-default">
      <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-elevated">
          <Search className="h-7 w-7 text-text-muted" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary">
          {hasSearch ? "No Matching Tokens" : "No Token Data"}
        </h3>
        <p className="max-w-sm text-sm text-text-secondary">
          {hasSearch
            ? "No tokens match your search query. Try a different symbol or name."
            : "No RSI data available yet. Click 'Scan Now' to start scanning tokens."}
        </p>
      </CardContent>
    </Card>
  );
}

/* ---------- Loading Skeleton ---------- */

function MarketSkeleton() {
  return (
    <div className="flex flex-col gap-6 py-8 md:py-16">
      {/* Header skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-5 w-80" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* Summary stats skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-4 p-5">
              <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-12" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + sort skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-full sm:max-w-xs rounded-lg" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
      </div>

      {/* Table skeleton (desktop) */}
      <Card className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default">
                <th className="px-5 py-3.5 text-left">
                  <Skeleton className="h-3 w-12" />
                </th>
                <th className="px-5 py-3.5 text-left">
                  <Skeleton className="h-3 w-12" />
                </th>
                <th className="px-5 py-3.5 text-center">
                  <Skeleton className="mx-auto h-3 w-6" />
                </th>
                <th className="px-5 py-3.5 text-center">
                  <Skeleton className="mx-auto h-3 w-6" />
                </th>
                <th className="px-5 py-3.5 text-center">
                  <Skeleton className="mx-auto h-3 w-6" />
                </th>
                <th className="px-5 py-3.5 text-right">
                  <Skeleton className="ml-auto h-3 w-10" />
                </th>
                <th className="px-5 py-3.5 text-right">
                  <Skeleton className="ml-auto h-3 w-16" />
                </th>
                <th className="px-5 py-3.5 text-left">
                  <Skeleton className="h-3 w-12" />
                </th>
                <th className="px-5 py-3.5 text-right">
                  <Skeleton className="ml-auto h-3 w-14" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-lg" />
                      <div className="flex flex-col gap-1">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <Skeleton className="h-8 w-16 rounded-full" />
                  </td>
                  <td className="px-5 py-3.5">
                    <Skeleton className="mx-auto h-4 w-10" />
                  </td>
                  <td className="px-5 py-3.5">
                    <Skeleton className="mx-auto h-4 w-10" />
                  </td>
                  <td className="px-5 py-3.5">
                    <Skeleton className="mx-auto h-4 w-10" />
                  </td>
                  <td className="px-5 py-3.5">
                    <Skeleton className="ml-auto h-4 w-16" />
                  </td>
                  <td className="px-5 py-3.5">
                    <Skeleton className="ml-auto h-4 w-14" />
                  </td>
                  <td className="px-5 py-3.5">
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </td>
                  <td className="px-5 py-3.5">
                    <Skeleton className="ml-auto h-3 w-12" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Card skeleton (mobile) */}
      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-8 w-14 rounded-full" />
              </div>
              <Skeleton className="h-10 w-full rounded-lg" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-14" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
