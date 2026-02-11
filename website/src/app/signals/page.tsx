"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, timeAgo } from "@/lib/utils";
import {
  Radio,
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  Clock,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

/* ---------- Types ---------- */

interface SignalReasoning {
  technical?: string;
  fundamental?: string;
  sentiment?: string;
}

interface TechnicalAnalysis {
  rsi?: { value: number; signal: string };
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
    trend: string;
    crossover: string | null;
  };
  trend?: {
    direction: string;
    strength: number;
    ema20: number;
    ema50: number;
    ema200: number;
  };
  support?: number[];
  resistance?: number[];
  momentum?: { value: number; increasing: boolean };
}

interface SignalIndicators {
  rsi_4h?: number;
  rsi_1d?: number;
  macd_trend?: string;
  macd_histogram?: number;
  trend_direction?: string;
  trend_strength?: number;
  momentum?: number;
  volume_trend?: string;
}

interface Signal {
  id: string;
  token: { symbol: string; address: string; name: string; decimals?: number };
  action: "LONG" | "SHORT";
  confidence: number;
  entry: number;
  targets: number[];
  stopLoss: number;
  timeframe: string;
  timestamp: string;
  reasoning: SignalReasoning;
  riskLevel?: string;
  technicalAnalysis?: TechnicalAnalysis;
  indicators?: SignalIndicators;
}

interface SignalsResponse {
  success: boolean;
  signals: Signal[];
  count: number;
}

type ActionFilter = "ALL" | "LONG" | "SHORT";

/* ---------- Constants ---------- */

const POLL_INTERVAL_MS = 30_000;

const FILTER_OPTIONS: ActionFilter[] = ["ALL", "LONG", "SHORT"];

const CONFIDENCE_THRESHOLDS = {
  LOW: 40,
  MEDIUM: 65,
} as const;

/* ---------- Page Component ---------- */

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [count, setCount] = useState(0);
  const [filter, setFilter] = useState<ActionFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSignals = useCallback(
    async (showRefreshSpinner = false) => {
      if (showRefreshSpinner) setRefreshing(true);

      try {
        const queryParam = filter !== "ALL" ? `?action=${filter}` : "";
        const res = await fetch(`/api/signals/latest${queryParam}`);
        if (!res.ok) throw new Error(`API ${res.status}`);

        const data: SignalsResponse = await res.json();

        if (data.success) {
          setSignals(data.signals);
          setCount(data.count);
          setLastUpdated(new Date());
        }
      } catch {
        /* Silently fail on poll — keep stale data visible */
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter]
  );

  /* Initial fetch + poll every 30s */
  useEffect(() => {
    setLoading(true);
    fetchSignals();

    const interval = setInterval(() => fetchSignals(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchSignals]);

  /* ---------- Manual refresh ---------- */

  function handleRefresh() {
    fetchSignals(true);
  }

  /* ---------- Loading skeleton ---------- */

  if (loading) {
    return <SignalsSkeleton />;
  }

  /* ---------- Render ---------- */

  return (
    <div className="flex flex-col gap-6 py-8 md:py-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-text-primary md:text-4xl">
              Live Signals
            </h1>
            <span className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-long-green opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-long-green" />
              </span>
              <span className="text-sm font-semibold tabular-nums text-text-secondary">
                {count}
              </span>
            </span>
          </div>
          <p className="text-text-secondary">
            Real-time AI-generated trading signals for Solana tokens.
          </p>
        </div>

        {/* Last updated + refresh */}
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-text-muted">
              Updated {timeAgo(lastUpdated.toISOString())}
            </span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-elevated px-3 py-1.5 text-xs font-semibold text-text-primary transition-colors hover:bg-bg-hover disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              filter === option
                ? "bg-brand-purple/20 text-brand-purple-light"
                : "bg-bg-elevated text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {/* Signal grid or empty state */}
      {signals.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Sub-components
   ================================================================ */

/* ---------- Signal Card ---------- */

function SignalCard({ signal }: { signal: Signal }) {
  const isLong = signal.action === "LONG";
  const ActionIcon = isLong ? TrendingUp : TrendingDown;
  const reasoning = signal.reasoning?.technical || "";
  const truncatedReasoning =
    reasoning.length > 160 ? `${reasoning.slice(0, 157)}...` : reasoning;

  return (
    <Card className="transition-colors hover:border-brand-purple/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          {/* Token info */}
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                isLong ? "bg-long-green-dim" : "bg-short-red-dim"
              }`}
            >
              <ActionIcon
                className={`h-5 w-5 ${
                  isLong ? "text-long-green" : "text-short-red"
                }`}
              />
            </div>
            <div className="flex flex-col">
              <CardTitle className="text-base">
                {signal.token.symbol}
              </CardTitle>
              <span className="text-xs text-text-muted">
                {signal.token.name}
              </span>
            </div>
          </div>

          {/* Action badge + timeframe */}
          <div className="flex items-center gap-2">
            <Badge variant={isLong ? "long" : "short"}>
              {signal.action}
            </Badge>
            <Badge variant="muted">
              <Clock className="mr-1 h-3 w-3" />
              {signal.timeframe}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Confidence bar */}
        <ConfidenceBar confidence={signal.confidence} />

        {/* Price levels */}
        <div className="grid grid-cols-2 gap-3">
          {/* Entry */}
          <PriceLevel
            icon={Radio}
            label="Entry"
            price={signal.entry}
            colorClass="text-brand-cyan"
          />

          {/* Stop Loss */}
          <PriceLevel
            icon={Shield}
            label="Stop Loss"
            price={signal.stopLoss}
            colorClass="text-short-red"
          />

          {/* Targets */}
          {signal.targets.slice(0, 3).map((tp, i) => (
            <PriceLevel
              key={i}
              icon={Target}
              label={`TP${i + 1}`}
              price={tp}
              colorClass="text-long-green"
            />
          ))}
        </div>

        {/* Indicators + Risk Level */}
        <div className="flex flex-wrap items-center gap-2">
          {signal.indicators?.rsi_4h != null && (
            <IndicatorBadge label="RSI" value={signal.indicators.rsi_4h} />
          )}
          {signal.indicators?.macd_trend && (
            <IndicatorBadge label="MACD" value={signal.indicators.macd_trend} />
          )}
          {signal.indicators?.volume_trend && (
            <Badge variant="muted" className="text-xs">
              Vol: {signal.indicators.volume_trend}
            </Badge>
          )}
          {signal.indicators?.trend_direction && (
            <Badge variant="muted" className="text-xs">
              Trend: {signal.indicators.trend_direction}
            </Badge>
          )}
          {signal.riskLevel && (
            <RiskLevelBadge riskLevel={signal.riskLevel} />
          )}
        </div>

        {/* Reasoning */}
        {truncatedReasoning && (
          <p className="text-xs leading-relaxed text-text-muted">
            {truncatedReasoning}
          </p>
        )}

        {/* Timestamp */}
        <div className="flex items-center justify-end">
          <span className="text-xs text-text-muted">
            {timeAgo(signal.timestamp)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Confidence Bar ---------- */

function ConfidenceBar({ confidence }: { confidence: number }) {
  const clampedConfidence = Math.max(0, Math.min(100, confidence));

  function getConfidenceColor(value: number): string {
    if (value < CONFIDENCE_THRESHOLDS.LOW) return "bg-short-red";
    if (value < CONFIDENCE_THRESHOLDS.MEDIUM) return "bg-yellow-500";
    return "bg-long-green";
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-text-secondary">Confidence</span>
        <span className="font-bold tabular-nums text-text-primary">
          {clampedConfidence}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-bg-elevated">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getConfidenceColor(clampedConfidence)}`}
          style={{ width: `${clampedConfidence}%` }}
        />
      </div>
    </div>
  );
}

/* ---------- Price Level ---------- */

function PriceLevel({
  icon: Icon,
  label,
  price,
  colorClass,
}: {
  icon: React.ElementType;
  label: string;
  price: number;
  colorClass: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-bg-elevated px-3 py-2">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${colorClass}`} />
      <div className="flex flex-col">
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
          {label}
        </span>
        <span className="text-sm font-semibold tabular-nums text-text-primary">
          ${formatPrice(price)}
        </span>
      </div>
    </div>
  );
}

/* ---------- Indicator Badge ---------- */

function IndicatorBadge({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  const displayValue =
    typeof value === "number" ? value.toFixed(2) : value;

  return (
    <Badge variant="muted" className="text-xs">
      {label}:{" "}
      <span className="ml-0.5 font-bold tabular-nums">{displayValue}</span>
    </Badge>
  );
}

/* ---------- Risk Level Badge ---------- */

function RiskLevelBadge({ riskLevel }: { riskLevel: string }) {
  const RISK_VARIANT_MAP: Record<string, "long" | "warning" | "short" | "muted"> = {
    LOW: "long",
    MEDIUM: "warning",
    HIGH: "short",
  };

  const variant = RISK_VARIANT_MAP[riskLevel.toUpperCase()] ?? "muted";

  return (
    <Badge variant={variant} className="text-xs">
      <AlertTriangle className="mr-1 h-3 w-3" />
      {riskLevel}
    </Badge>
  );
}

/* ---------- Empty State ---------- */

function EmptyState({ filter }: { filter: ActionFilter }) {
  const filterLabel = filter === "ALL" ? "" : ` ${filter}`;

  return (
    <Card className="border-border-default">
      <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-elevated">
          <Radio className="h-7 w-7 text-text-muted" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary">
          No{filterLabel} Signals
        </h3>
        <p className="max-w-sm text-sm text-text-secondary">
          There are no{filterLabel.toLowerCase()} signals at the moment. The
          scanner runs every hour — check back soon or try a different filter.
        </p>
      </CardContent>
    </Card>
  );
}

/* ---------- Loading Skeleton ---------- */

function SignalsSkeleton() {
  const SKELETON_CARD_COUNT = 4;

  return (
    <div className="flex flex-col gap-6 py-8 md:py-16">
      {/* Header skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>
          <Skeleton className="h-5 w-80" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      {/* Filter pills skeleton */}
      <div className="flex items-center gap-2">
        {FILTER_OPTIONS.map((option) => (
          <Skeleton key={option} className="h-8 w-16 rounded-full" />
        ))}
      </div>

      {/* Signal cards skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: SKELETON_CARD_COUNT }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Confidence bar skeleton */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>

              {/* Price levels skeleton */}
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="h-12 rounded-lg" />
                ))}
              </div>

              {/* Indicators skeleton */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>

              {/* Reasoning skeleton */}
              <Skeleton className="h-8 w-full" />

              {/* Timestamp skeleton */}
              <div className="flex justify-end">
                <Skeleton className="h-3 w-12" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
