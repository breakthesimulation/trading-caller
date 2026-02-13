"use client";

import { useEffect, useState } from "react";
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
  FlaskConical,
  Trophy,
  Target,
  TrendingUp,
  BarChart3,
} from "lucide-react";

/* ---------- Types ---------- */

interface BacktestResult {
  strategy: string;
  symbol: string;
  trades: number;
  winRate: number;
  totalPnl: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

interface StrategyOverview {
  name: string;
  winRate: number;
  avgPnl: number;
  totalTrades: number;
  profitFactor: number;
}

interface ResultsResponse {
  success: boolean;
  results: BacktestResult[];
}

interface StrategiesResponse {
  success: boolean;
  strategies: StrategyOverview[];
}

/* ---------- Constants ---------- */

const WIN_RATE_THRESHOLDS = {
  HIGH: 60,
  LOW: 40,
} as const;

/* ---------- Page Component ---------- */

export default function BacktestPage() {
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [strategies, setStrategies] = useState<StrategyOverview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [resultsRes, strategiesRes] = await Promise.all([
          fetch("/api/backtest/results"),
          fetch("/api/backtest/analysis/strategies"),
        ]);

        if (resultsRes.ok) {
          const resultsData: ResultsResponse = await resultsRes.json();
          if (resultsData.success) {
            setResults(resultsData.results);
          }
        }

        if (strategiesRes.ok) {
          const strategiesData: StrategiesResponse =
            await strategiesRes.json();
          if (strategiesData.success) {
            setStrategies(strategiesData.strategies);
          }
        }
      } catch {
        /* Silently fail -- keep empty state visible */
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  /* ---------- Loading skeleton ---------- */

  if (loading) {
    return <BacktestSkeleton />;
  }

  /* ---------- Determine best strategy ---------- */

  const bestStrategyName = findBestStrategy(strategies);

  /* ---------- Render ---------- */

  return (
    <div className="flex flex-col gap-8 py-8 md:py-16">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-8 w-8 text-accent-light" />
          <h1 className="text-3xl font-extrabold tracking-tight text-primary md:text-4xl">
            Backtest Results
          </h1>
        </div>
        <p className="text-text-secondary">
          Historical strategy performance analysis
        </p>
      </div>

      {/* Strategy Comparison */}
      {strategies.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-cyan" />
            <h2 className="text-xl font-bold text-primary">
              Strategy Comparison
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {strategies.map((strategy) => (
              <StrategyCard
                key={strategy.name}
                strategy={strategy}
                isBest={strategy.name === bestStrategyName}
              />
            ))}
          </div>
        </section>
      )}

      {/* Detailed Results */}
      {results.length === 0 ? (
        <EmptyState />
      ) : (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-accent-light" />
            <h2 className="text-xl font-bold text-primary">
              Detailed Results
            </h2>
          </div>

          {/* Desktop table */}
          <DesktopTable results={results} />

          {/* Mobile cards */}
          <MobileCards results={results} />
        </section>
      )}
    </div>
  );
}

/* ================================================================
   Helpers
   ================================================================ */

function findBestStrategy(strategies: StrategyOverview[]): string | null {
  if (strategies.length === 0) return null;

  let best = strategies[0];
  for (const s of strategies) {
    if (s.profitFactor > best.profitFactor) {
      best = s;
    }
  }
  return best.name;
}

/* ================================================================
   Sub-components
   ================================================================ */

/* ---------- Strategy Card ---------- */

function StrategyCard({
  strategy,
  isBest,
}: {
  strategy: StrategyOverview;
  isBest: boolean;
}) {
  const pnlColorClass =
    strategy.avgPnl > 0
      ? "text-long"
      : strategy.avgPnl < 0
        ? "text-short"
        : "text-text-secondary";

  return (
    <Card
      className={
        isBest
          ? "border-accent transition-colors"
          : "transition-colors hover:border-accent"
      }
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{strategy.name}</CardTitle>
          {isBest && (
            <div className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-yellow-400" />
              <Badge variant="warning">Best</Badge>
            </div>
          )}
        </div>
        {isBest && (
          <CardDescription>Top performing strategy</CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Win Rate with progress bar */}
        <WinRateBar winRate={strategy.winRate} />

        {/* Metrics grid */}
        <div className="grid grid-cols-3 gap-3">
          <MetricCell label="Avg PnL">
            <span className={`text-sm font-semibold tabular-nums ${pnlColorClass}`}>
              {formatPnl(strategy.avgPnl)}
            </span>
          </MetricCell>

          <MetricCell label="Trades">
            <span className="text-sm font-semibold tabular-nums text-primary">
              {strategy.totalTrades}
            </span>
          </MetricCell>

          <MetricCell label="Profit Factor">
            <span
              className={`text-sm font-semibold tabular-nums ${
                strategy.profitFactor >= 1
                  ? "text-long"
                  : "text-short"
              }`}
            >
              {strategy.profitFactor.toFixed(2)}
            </span>
          </MetricCell>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Win Rate Progress Bar ---------- */

function WinRateBar({ winRate }: { winRate: number }) {
  const clampedRate = Math.max(0, Math.min(100, winRate));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-text-secondary">Win Rate</span>
        <span
          className={`font-bold tabular-nums ${
            clampedRate >= WIN_RATE_THRESHOLDS.HIGH
              ? "text-long"
              : clampedRate < WIN_RATE_THRESHOLDS.LOW
                ? "text-short"
                : "text-primary"
          }`}
        >
          {clampedRate.toFixed(1)}%
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-bg-elevated">
        <div
          className="h-full rounded-full bg-gradient-to-r from-long/70 to-long transition-all duration-500"
          style={{ width: `${clampedRate}%` }}
        />
      </div>
    </div>
  );
}

/* ---------- Metric Cell ---------- */

function MetricCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-bg-elevated px-3 py-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

/* ---------- PnL Display ---------- */

function PnlDisplay({
  pnl,
  bold = false,
}: {
  pnl: number;
  bold?: boolean;
}) {
  const colorClass =
    pnl > 0
      ? "text-long"
      : pnl < 0
        ? "text-short"
        : "text-text-secondary";

  return (
    <span
      className={`tabular-nums ${colorClass} ${bold ? "font-bold" : "font-semibold"}`}
    >
      {formatPnl(pnl)}
    </span>
  );
}

/* ---------- Win Rate Cell ---------- */

function WinRateDisplay({ winRate }: { winRate: number }) {
  let colorClass = "text-text-secondary";

  if (winRate >= WIN_RATE_THRESHOLDS.HIGH) {
    colorClass = "text-long";
  } else if (winRate < WIN_RATE_THRESHOLDS.LOW) {
    colorClass = "text-short";
  }

  return (
    <span className={`font-semibold tabular-nums ${colorClass}`}>
      {winRate.toFixed(1)}%
    </span>
  );
}

/* ---------- Desktop Table ---------- */

function DesktopTable({ results }: { results: BacktestResult[] }) {
  return (
    <Card className="hidden md:block">
      <CardContent className="p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                Strategy
              </th>
              <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                Symbol
              </th>
              <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                Trades
              </th>
              <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                Win Rate (%)
              </th>
              <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                Total PnL (%)
              </th>
              <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                Profit Factor
              </th>
              <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                Max Drawdown (%)
              </th>
              <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                Sharpe Ratio
              </th>
            </tr>
          </thead>
          <tbody className="[&>tr:nth-child(even)]:bg-bg-secondary">
            {results.map((result, index) => (
              <DesktopRow key={`${result.strategy}-${result.symbol}-${index}`} result={result} />
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/* ---------- Desktop Table Row ---------- */

function DesktopRow({ result }: { result: BacktestResult }) {
  return (
    <tr className="border-b border-border-subtle transition-colors last:border-b-0 hover:bg-bg-elevated">
      {/* Strategy */}
      <td className="px-5 py-4">
        <Badge variant="default">{result.strategy}</Badge>
      </td>

      {/* Symbol */}
      <td className="px-5 py-4">
        <span className="text-sm font-bold text-primary">
          {result.symbol}
        </span>
      </td>

      {/* Trades */}
      <td className="px-5 py-4 text-right">
        <span className="text-sm font-semibold tabular-nums text-primary">
          {result.trades}
        </span>
      </td>

      {/* Win Rate */}
      <td className="px-5 py-4 text-right">
        <WinRateDisplay winRate={result.winRate} />
      </td>

      {/* Total PnL */}
      <td className="px-5 py-4 text-right">
        <PnlDisplay pnl={result.totalPnl} bold />
      </td>

      {/* Profit Factor */}
      <td className="px-5 py-4 text-right">
        <span
          className={`font-semibold tabular-nums ${
            result.profitFactor >= 1 ? "text-long" : "text-short"
          }`}
        >
          {result.profitFactor.toFixed(2)}
        </span>
      </td>

      {/* Max Drawdown */}
      <td className="px-5 py-4 text-right">
        <span className="font-semibold tabular-nums text-short">
          {result.maxDrawdown.toFixed(2)}%
        </span>
      </td>

      {/* Sharpe Ratio */}
      <td className="px-5 py-4 text-right">
        <span
          className={`font-semibold tabular-nums ${
            result.sharpeRatio >= 1
              ? "text-long"
              : result.sharpeRatio >= 0
                ? "text-text-secondary"
                : "text-short"
          }`}
        >
          {result.sharpeRatio.toFixed(2)}
        </span>
      </td>
    </tr>
  );
}

/* ---------- Mobile Cards ---------- */

function MobileCards({ results }: { results: BacktestResult[] }) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {results.map((result, index) => (
        <MobileResultCard
          key={`${result.strategy}-${result.symbol}-${index}`}
          result={result}
        />
      ))}
    </div>
  );
}

/* ---------- Mobile Result Card ---------- */

function MobileResultCard({ result }: { result: BacktestResult }) {
  const PnlIcon = result.totalPnl >= 0 ? TrendingUp : FlaskConical;
  const pnlIconColor =
    result.totalPnl > 0
      ? "text-long"
      : result.totalPnl < 0
        ? "text-short"
        : "text-text-muted";

  return (
    <Card className="transition-colors hover:border-accent">
      <CardContent className="flex flex-col gap-4 p-5">
        {/* Top row: Strategy + Symbol */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-elevated">
              <PnlIcon className={`h-5 w-5 ${pnlIconColor}`} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-primary">
                {result.symbol}
              </span>
              <Badge variant="default" className="w-fit text-[10px]">
                {result.strategy}
              </Badge>
            </div>
          </div>
          <PnlDisplay pnl={result.totalPnl} bold />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCell label="Trades">
            <span className="text-sm font-semibold tabular-nums text-primary">
              {result.trades}
            </span>
          </MetricCell>
          <MetricCell label="Win Rate">
            <WinRateDisplay winRate={result.winRate} />
          </MetricCell>
          <MetricCell label="Profit Factor">
            <span
              className={`text-sm font-semibold tabular-nums ${
                result.profitFactor >= 1
                  ? "text-long"
                  : "text-short"
              }`}
            >
              {result.profitFactor.toFixed(2)}
            </span>
          </MetricCell>
          <MetricCell label="Max Drawdown">
            <span className="text-sm font-semibold tabular-nums text-short">
              {result.maxDrawdown.toFixed(2)}%
            </span>
          </MetricCell>
          <MetricCell label="Sharpe Ratio">
            <span
              className={`text-sm font-semibold tabular-nums ${
                result.sharpeRatio >= 1
                  ? "text-long"
                  : result.sharpeRatio >= 0
                    ? "text-text-secondary"
                    : "text-short"
              }`}
            >
              {result.sharpeRatio.toFixed(2)}
            </span>
          </MetricCell>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Empty State ---------- */

function EmptyState() {
  return (
    <Card className="border-border">
      <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-elevated">
          <FlaskConical className="h-7 w-7 text-text-muted" />
        </div>
        <h3 className="text-lg font-semibold text-primary">
          No Backtest Data
        </h3>
        <p className="max-w-sm text-sm text-text-secondary">
          No backtest results available yet. Once strategies are backtested
          against historical data, performance metrics will appear here.
        </p>
      </CardContent>
    </Card>
  );
}

/* ---------- Loading Skeleton ---------- */

function BacktestSkeleton() {
  const SKELETON_STRATEGY_COUNT = 3;
  const SKELETON_ROW_COUNT = 6;

  return (
    <div className="flex flex-col gap-8 py-8 md:py-16">
      {/* Header skeleton */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-10 w-56" />
        </div>
        <Skeleton className="h-5 w-72" />
      </div>

      {/* Strategy Comparison skeleton */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-7 w-48" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: SKELETON_STRATEGY_COUNT }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-32" />
                  {i === 0 && <Skeleton className="h-5 w-16 rounded-full" />}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* Win rate bar skeleton */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                  <Skeleton className="h-2.5 w-full rounded-full" />
                </div>
                {/* Metrics grid skeleton */}
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={j} className="h-12 rounded-lg" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Detailed Results skeleton */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-7 w-40" />
        </div>

        {/* Desktop table skeleton */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            {/* Table header */}
            <div className="flex items-center gap-4 border-b border-border-subtle px-5 py-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <div className="ml-auto flex items-center gap-6">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>

            {/* Table rows */}
            {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-border-subtle px-5 py-4 last:border-b-0"
              >
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-4 w-16" />
                <div className="ml-auto flex items-center gap-6">
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-10" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Mobile card skeletons */}
        <div className="flex flex-col gap-3 md:hidden">
          {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex flex-col gap-4 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div className="flex flex-col gap-1">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20 rounded-full" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Skeleton key={j} className="h-12 rounded-lg" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
