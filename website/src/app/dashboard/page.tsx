"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPnl, formatPrice, timeAgo } from "@/lib/utils";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  RefreshCw,
  Clock,
  Shield,
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

interface OpenPosition {
  id: string;
  token: { symbol: string; address: string };
  action: "LONG" | "SHORT";
  status: string;
  entry: number;
  current: number;
  targets: { tp1: number; tp2: number; tp3: number; hit: { tp1: boolean; tp2: boolean; tp3: boolean } };
  stopLoss: number;
  pnl: number;
  highestPnl: number;
  lowestPnl: number;
  timeInPosition: string;
  openedAt: string;
  confidence: number;
}

interface ClosedPosition {
  id: string;
  token: { symbol: string };
  action: "LONG" | "SHORT";
  status: string;
  entry: number;
  current: number;
  pnl: number;
  timeInPosition: string;
  openedAt: string;
  closedAt?: string;
  confidence: number;
}

/* ---------- Constants ---------- */

const REFRESH_INTERVAL_MS = 30_000;
const API_BASE = "/api";

/* ---------- Helpers ---------- */

function parsePercent(value: string | undefined | null): number {
  if (!value) return 0;
  return parseFloat(value.replace(/[^0-9.\-+]/g, "")) || 0;
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    ACTIVE: "Active",
    TP1_HIT: "TP1",
    TP2_HIT: "TP2",
    TP3_HIT: "TP3",
    STOPPED_OUT: "Stopped",
    EXPIRED: "Expired",
  };
  return labels[status] ?? status;
}

function statusVariant(status: string): "long" | "short" | "muted" | "purple" | "default" {
  if (["TP1_HIT", "TP2_HIT"].includes(status)) return "long";
  if (status === "TP3_HIT") return "purple";
  if (status === "STOPPED_OUT") return "short";
  if (status === "EXPIRED") return "muted";
  return "default";
}

/* ---------- Page Component ---------- */

export default function DashboardPage() {
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);
  const [closedPositions, setClosedPositions] = useState<ClosedPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [perfRes, openRes, closedRes] = await Promise.allSettled([
        fetch(`${API_BASE}/signals/performance`),
        fetch(`${API_BASE}/positions/open`),
        fetch(`${API_BASE}/positions/closed?limit=20`),
      ]);

      if (perfRes.status === "fulfilled" && perfRes.value.ok) {
        const data = await perfRes.value.json();
        if (data.success) setPerformance(data.performance);
      }

      if (openRes.status === "fulfilled" && openRes.value.ok) {
        const data = await openRes.value.json();
        if (data.success) setOpenPositions(data.positions ?? []);
      }

      if (closedRes.status === "fulfilled" && closedRes.value.ok) {
        const data = await closedRes.value.json();
        if (data.success) setClosedPositions(data.positions ?? []);
      }

      const anySucceeded =
        (perfRes.status === "fulfilled" && perfRes.value.ok) ||
        (openRes.status === "fulfilled" && openRes.value.ok);

      if (!anySucceeded) {
        setError("Could not reach the Trading Caller API.");
      } else {
        setError(null);
      }

      setLastUpdated(new Date());
    } catch {
      setError("Could not reach the Trading Caller API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  /* ---------- Loading skeleton ---------- */

  if (loading) {
    return <DashboardSkeleton />;
  }

  /* ---------- Error state ---------- */

  if (error && !performance) {
    return (
      <div className="flex flex-col gap-6 py-8 md:py-16">
        <PageHeading lastUpdated={lastUpdated} onRefresh={fetchData} />
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
              onClick={fetchData}
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
      <PageHeading lastUpdated={lastUpdated} onRefresh={fetchData} />

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

      {/* ---------- Open Positions ---------- */}
      {openPositions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-accent-light" />
              Open Positions
              <Badge variant="default">{openPositions.length}</Badge>
            </CardTitle>
            <CardDescription>
              Live positions with real-time P&L — auto-refreshes every 30s
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead className="text-right">Entry</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">PnL</TableHead>
                  <TableHead className="text-right">SL</TableHead>
                  <TableHead className="text-right">TP1</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Conf</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openPositions.map((pos) => (
                  <TableRow key={pos.id}>
                    <TableCell className="font-semibold">{pos.token.symbol}</TableCell>
                    <TableCell>
                      <Badge variant={pos.action === "LONG" ? "long" : "short"}>
                        {pos.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${formatPrice(pos.entry)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${formatPrice(pos.current)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums font-semibold ${
                        pos.pnl > 0 ? "text-long" : pos.pnl < 0 ? "text-short" : "text-primary"
                      }`}
                    >
                      {pos.pnl >= 0 ? "+" : ""}{pos.pnl.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-short">
                      ${formatPrice(pos.stopLoss)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-long">
                      ${formatPrice(pos.targets.tp1)}
                    </TableCell>
                    <TableCell className="text-text-secondary">
                      {pos.timeInPosition}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{pos.confidence}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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

      {/* ---------- PnL Details ---------- */}
      {performance && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-primary">PnL Details</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MiniStat label="Avg PnL" value={performance.pnl.average} accent={parsePercent(performance.pnl.average) > 0} />
            <MiniStat label="Avg Win" value={performance.pnl.averageWin} accent />
            <MiniStat label="Avg Loss" value={performance.pnl.averageLoss} />
            <MiniStat label="Avg Time to TP1" value={performance.timing.avgTimeToTP1} />
          </div>
        </section>
      )}

      {/* ---------- Recent Closed Trades ---------- */}
      {closedPositions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-text-muted" />
              Recent Trades
            </CardTitle>
            <CardDescription>
              Last {closedPositions.length} resolved positions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead className="text-right">Entry</TableHead>
                  <TableHead className="text-right">Exit</TableHead>
                  <TableHead className="text-right">PnL</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Closed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closedPositions.map((pos) => (
                  <TableRow key={pos.id}>
                    <TableCell className="font-semibold">{pos.token.symbol}</TableCell>
                    <TableCell>
                      <Badge variant={pos.action === "LONG" ? "long" : "short"}>
                        {pos.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(pos.status)}>
                        {statusLabel(pos.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${formatPrice(pos.entry)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${formatPrice(pos.current)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums font-semibold ${
                        pos.pnl > 0 ? "text-long" : pos.pnl < 0 ? "text-short" : "text-primary"
                      }`}
                    >
                      {pos.pnl >= 0 ? "+" : ""}{pos.pnl.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-text-secondary">
                      {pos.timeInPosition}
                    </TableCell>
                    <TableCell className="text-text-muted text-xs">
                      {pos.closedAt ? timeAgo(pos.closedAt) : pos.openedAt ? timeAgo(pos.openedAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ================================================================
   Sub-components
   ================================================================ */

function PageHeading({ lastUpdated, onRefresh }: { lastUpdated: Date | null; onRefresh: () => void }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-primary md:text-4xl">
          Performance Dashboard
        </h1>
        <p className="text-text-secondary">
          Real-time accuracy metrics and outcome tracking for all Agent Fox
          signals.
        </p>
      </div>
      <div className="flex items-center gap-3">
        {lastUpdated && (
          <span className="text-xs text-text-muted">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-primary"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>
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

      {/* Positions skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>

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
