"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPnl } from "@/lib/utils";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
} from "lucide-react";

/* ---------- API response types (matching real server shapes) ---------- */

interface PerformanceSummary {
  total: number;
  active: number;
  resolved: number;
}

interface PerformanceOutcomes {
  tp1Hits: number;
  tp2Hits: number;
  tp3Hits: number;
  stoppedOut: number;
  expired: number;
  invalidated: number;
}

interface PerformanceRates {
  winRate: string;
  fullWinRate: string;
  lossRate: string;
}

interface PerformancePnl {
  average: string;
  averageWin: string;
  averageLoss: string;
  total: string;
  profitFactor: string;
}

interface PerformanceTiming {
  avgTimeToTP1: string;
  avgTimeToStop: string;
}

interface DirectionStats {
  total: number;
  wins: number;
  losses: number;
  winRate: string;
  avgPnl: string;
}

interface PerformanceData {
  summary: PerformanceSummary;
  outcomes: PerformanceOutcomes;
  rates: PerformanceRates;
  pnl: PerformancePnl;
  timing: PerformanceTiming;
  byDirection: {
    long: DirectionStats;
    short: DirectionStats;
  };
}

interface PositionDirectionStats {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPnl: number;
}

interface PositionTradeInfo {
  id: string;
  token: { symbol: string };
  action: string;
  pnl: number;
}

interface PositionStats {
  totalPositions: number;
  openPositions: number;
  closedPositions: number;
  totalPnl: number;
  avgPnl: number;
  winRate: number;
  wins: number;
  losses: number;
  tp1Hits: number;
  tp2Hits: number;
  tp3Hits: number;
  stoppedOut: number;
  expired: number;
  profitFactor: number;
  long: PositionDirectionStats;
  short: PositionDirectionStats;
  bestTrade: PositionTradeInfo | null;
  worstTrade: PositionTradeInfo | null;
}

/* ---------- Helpers ---------- */

/** Parse a percentage string like "12.5%" or "+3.2%" into a number. */
function parsePercent(value: string | undefined | null): number {
  if (!value) return 0;
  return parseFloat(value.replace(/[^0-9.\-+]/g, "")) || 0;
}

/* ---------- Page Component ---------- */

export default function DashboardPage() {
  /* Hardcoded zero stats until API routing is fixed */
  const performance: PerformanceData = {
    summary: { total: 0, active: 0, resolved: 0 },
    outcomes: { tp1Hits: 0, tp2Hits: 0, tp3Hits: 0, stoppedOut: 0, expired: 0, invalidated: 0 },
    rates: { winRate: "0.0%", fullWinRate: "0.0%", lossRate: "0.0%" },
    pnl: { average: "+0.00%", averageWin: "+0.00%", averageLoss: "0.00%", total: "+0.00%", profitFactor: "0.00" },
    timing: { avgTimeToTP1: "0.0h", avgTimeToStop: "0.0h" },
    byDirection: {
      long: { total: 0, wins: 0, losses: 0, winRate: "0.0%", avgPnl: "+0.00%" },
      short: { total: 0, wins: 0, losses: 0, winRate: "0.0%", avgPnl: "+0.00%" },
    },
  };
  const positions: PositionStats | null = null;
  const loading = false;
  const error: string | null = null;

  /* ---------- Loading skeleton ---------- */

  if (loading) {
    return <DashboardSkeleton />;
  }

  /* ---------- Error state ---------- */

  if (error && !performance && !positions) {
    return (
      <div className="flex flex-col gap-6 py-8 md:py-16">
        <PageHeading />
        <Card className="border-short/30">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-short/15">
              <Activity className="h-7 w-7 text-short" />
            </div>
            <h3 className="text-lg font-semibold text-primary">
              API Unavailable
            </h3>
            <p className="max-w-md text-sm text-text-secondary">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 inline-flex items-center gap-2 rounded-xl border border-border bg-bg-elevated px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-bg-elevated"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---------- Derived values ---------- */

  const totalSignals = performance?.summary?.total ?? 0;
  const activeSignals = performance?.summary?.active ?? 0;
  const resolvedSignals = performance?.summary?.resolved ?? 0;

  const winRate = parsePercent(performance?.rates?.winRate);
  const totalPnl = parsePercent(performance?.pnl?.total);
  const profitFactor = parseFloat(performance?.pnl?.profitFactor ?? "0") || 0;

  const outcomes = performance?.outcomes ?? {
    tp1Hits: 0,
    tp2Hits: 0,
    tp3Hits: 0,
    stoppedOut: 0,
    expired: 0,
    invalidated: 0,
  };

  const totalWins = outcomes.tp1Hits + outcomes.tp2Hits + outcomes.tp3Hits;
  const totalResolved =
    totalWins + outcomes.stoppedOut + outcomes.expired + outcomes.invalidated;

  return (
    <div className="flex flex-col gap-8 py-8 md:py-16">
      <PageHeading />

      {/* ---------- Top stat cards ---------- */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Target}
          label="Win Rate"
          value={`${winRate.toFixed(1)}%`}
          accent={winRate >= 50}
        />
        <MetricCard
          icon={TrendingUp}
          label="Total PnL"
          value={formatPnl(totalPnl)}
          accent={totalPnl > 0}
        />
        <MetricCard
          icon={BarChart3}
          label="Profit Factor"
          value={profitFactor.toFixed(2)}
          accent={profitFactor > 1}
        />
        <MetricCard
          icon={Activity}
          label="Total Signals"
          value={String(totalSignals)}
        />
      </section>

      {/* ---------- Outcome breakdown ---------- */}
      <Card>
        <CardHeader>
          <CardTitle>Outcome Breakdown</CardTitle>
          <CardDescription>
            Distribution of signal results across all tracked calls
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <OutcomeBar
            label="TP1 Hits"
            count={outcomes.tp1Hits}
            total={totalSignals}
            barClass="bg-long"
            textClass="text-long"
          />
          <OutcomeBar
            label="TP2 Hits"
            count={outcomes.tp2Hits}
            total={totalSignals}
            barClass="bg-long"
            textClass="text-long"
          />
          <OutcomeBar
            label="TP3 Hits"
            count={outcomes.tp3Hits}
            total={totalSignals}
            barClass="bg-purple"
            textClass="text-purple"
          />
          <OutcomeBar
            label="Stopped Out"
            count={outcomes.stoppedOut}
            total={totalSignals}
            barClass="bg-short"
            textClass="text-short"
          />
          <OutcomeBar
            label="Expired"
            count={outcomes.expired}
            total={totalSignals}
            barClass="bg-text-muted"
            textClass="text-text-muted"
          />
          <OutcomeBar
            label="Active"
            count={activeSignals}
            total={totalSignals}
            barClass="bg-accent"
            textClass="text-accent-light"
          />

          {totalResolved > 0 && (
            <p className="pt-1 text-xs text-text-muted">
              {totalResolved} resolved of {totalSignals} total signals
              ({activeSignals} still active)
            </p>
          )}
        </CardContent>
      </Card>

      {/* ---------- Long vs Short comparison ---------- */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-primary">
          Long vs Short Comparison
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DirectionCard
            direction="LONG"
            icon={TrendingUp}
            stats={performance?.byDirection?.long ?? null}
            accentBg="bg-long/15"
            accentText="text-long"
            badgeVariant="long"
          />
          <DirectionCard
            direction="SHORT"
            icon={TrendingDown}
            stats={performance?.byDirection?.short ?? null}
            accentBg="bg-short/15"
            accentText="text-short"
            badgeVariant="short"
          />
        </div>
      </section>

      {/* Position stats hidden while API routing is being fixed */}
    </div>
  );
}

/* ================================================================
   Sub-components
   ================================================================ */

function PageHeading() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-extrabold tracking-tight text-primary md:text-4xl">
        Performance Dashboard
      </h1>
      <p className="text-text-secondary">
        Real-time accuracy metrics and outcome tracking for all Agent Fox
        signals.
      </p>
    </div>
  );
}

/* ---------- Top-level metric card ---------- */

function MetricCard({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-l-4 border-l-long" : "border-l-4 border-l-accent"}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/15">
          <Icon className="h-5 w-5 text-accent-light" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-text-muted">{label}</span>
          <span
            className={`text-2xl font-bold tabular-nums ${
              accent ? "text-long" : "text-primary"
            }`}
          >
            {value}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Outcome bar row ---------- */

const MIN_BAR_PERCENT = 2;

function OutcomeBar({
  label,
  count,
  total,
  barClass,
  textClass,
}: {
  label: string;
  count: number;
  total: number;
  barClass: string;
  textClass: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const displayWidth = pct > 0 ? Math.max(pct, MIN_BAR_PERCENT) : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className={`font-medium ${textClass}`}>{label}</span>
        <span className="tabular-nums text-text-secondary">
          {count}{" "}
          <span className="text-text-muted">
            ({pct.toFixed(1)}%)
          </span>
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-bg-elevated">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barClass}`}
          style={{ width: `${displayWidth}%` }}
        />
      </div>
    </div>
  );
}

/* ---------- Long / Short direction card ---------- */

function DirectionCard({
  direction,
  icon: Icon,
  stats,
  accentBg,
  accentText,
  badgeVariant,
}: {
  direction: string;
  icon: React.ElementType;
  stats: DirectionStats | null;
  accentBg: string;
  accentText: string;
  badgeVariant: "long" | "short";
}) {
  const total = stats?.total ?? 0;
  const wr = parsePercent(stats?.winRate);
  const avgPnl = parsePercent(stats?.avgPnl);

  const borderTopClass = direction === "LONG" ? "border-t-4 border-t-long" : "border-t-4 border-t-short";

  return (
    <Card className={`transition-colors hover:border-accent/30 ${borderTopClass}`}>
      <CardContent className="flex flex-col gap-5 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${accentBg}`}
            >
              <Icon className={`h-5 w-5 ${accentText}`} />
            </div>
            <span className="text-lg font-semibold text-primary">
              {direction}
            </span>
          </div>
          <Badge variant={badgeVariant}>{total} calls</Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-text-muted">
              Win Rate
            </span>
            <span
              className={`text-xl font-bold tabular-nums ${
                wr >= 50 ? "text-long" : "text-primary"
              }`}
            >
              {wr.toFixed(1)}%
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-text-muted">
              Avg PnL
            </span>
            <span
              className={`text-xl font-bold tabular-nums ${
                avgPnl > 0 ? "text-long" : avgPnl < 0 ? "text-short" : "text-primary"
              }`}
            >
              {formatPnl(avgPnl)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-text-muted">Wins</span>
            <span className="text-sm font-semibold tabular-nums text-primary">
              {stats?.wins ?? 0}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-text-muted">Losses</span>
            <span className="text-sm font-semibold tabular-nums text-primary">
              {stats?.losses ?? 0}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Mini stat card ---------- */

function MiniStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-0.5 p-5">
        <span className="text-xs font-medium text-text-muted">{label}</span>
        <span
          className={`text-xl font-bold tabular-nums ${
            accent ? "text-long" : "text-primary"
          }`}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

/* ---------- Loading skeleton ---------- */

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8 py-8 md:py-16">
      {/* Heading skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-4 p-5">
              <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Outcome breakdown skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-3 w-full rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Long vs Short skeleton */}
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-56" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex flex-col gap-5 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-7 w-16" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-7 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
