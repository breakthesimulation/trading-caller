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
  Trophy,
  Medal,
  Crown,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

/* ---------- Types ---------- */

interface LeaderboardEntry {
  symbol: string;
  name: string;
  totalSignals: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  rank: number;
}

interface LeaderboardResponse {
  success: boolean;
  leaderboard: LeaderboardEntry[];
}

/* ---------- Constants ---------- */

const RANK_COLORS = {
  1: "#FFD700",
  2: "#C0C0C0",
  3: "#CD7F32",
} as const;

const WIN_RATE_THRESHOLDS = {
  HIGH: 60,
  LOW: 40,
} as const;

/* ---------- Page Component ---------- */

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await fetch("/api/leaderboard");
        if (!res.ok) throw new Error(`API ${res.status}`);

        const data: LeaderboardResponse = await res.json();

        if (data.success) {
          setEntries(data.leaderboard);
        }
      } catch {
        /* Silently fail -- keep empty state visible */
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, []);

  /* ---------- Loading skeleton ---------- */

  if (loading) {
    return <LeaderboardSkeleton />;
  }

  /* ---------- Render ---------- */

  return (
    <div className="flex flex-col gap-8 py-8 md:py-16">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-brand-purple-light" />
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary md:text-4xl">
            Token Leaderboard
          </h1>
        </div>
        <p className="text-text-secondary">
          Ranked by trading performance
        </p>
      </div>

      {/* Empty state or leaderboard */}
      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Desktop table */}
          <DesktopTable entries={entries} />

          {/* Mobile cards */}
          <MobileCards entries={entries} />
        </>
      )}
    </div>
  );
}

/* ================================================================
   Sub-components
   ================================================================ */

/* ---------- Rank Icon ---------- */

function RankDisplay({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: "rgba(255, 215, 0, 0.15)" }}
      >
        <Crown className="h-5 w-5" style={{ color: RANK_COLORS[1] }} />
      </div>
    );
  }

  if (rank === 2) {
    return (
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: "rgba(192, 192, 192, 0.15)" }}
      >
        <Medal className="h-5 w-5" style={{ color: RANK_COLORS[2] }} />
      </div>
    );
  }

  if (rank === 3) {
    return (
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: "rgba(205, 127, 50, 0.15)" }}
      >
        <Medal className="h-5 w-5" style={{ color: RANK_COLORS[3] }} />
      </div>
    );
  }

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-elevated">
      <span className="text-sm font-bold tabular-nums text-text-muted">
        {rank}
      </span>
    </div>
  );
}

/* ---------- Win Rate Cell ---------- */

function WinRateDisplay({ winRate }: { winRate: number }) {
  let colorClass = "text-text-secondary";

  if (winRate >= WIN_RATE_THRESHOLDS.HIGH) {
    colorClass = "text-long-green";
  } else if (winRate < WIN_RATE_THRESHOLDS.LOW) {
    colorClass = "text-short-red";
  }

  return (
    <span className={`font-semibold tabular-nums ${colorClass}`}>
      {winRate.toFixed(1)}%
    </span>
  );
}

/* ---------- PnL Cell ---------- */

function PnlDisplay({
  pnl,
  bold = false,
}: {
  pnl: number;
  bold?: boolean;
}) {
  const colorClass =
    pnl > 0
      ? "text-long-green"
      : pnl < 0
        ? "text-short-red"
        : "text-text-secondary";

  return (
    <span
      className={`tabular-nums ${colorClass} ${bold ? "font-bold" : "font-semibold"}`}
    >
      {formatPnl(pnl)}
    </span>
  );
}

/* ---------- Desktop Table ---------- */

function DesktopTable({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <Card className="hidden md:block">
      <CardContent className="p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                #
              </th>
              <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                Token
              </th>
              <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                Signals
              </th>
              <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                Win Rate
              </th>
              <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                Avg PnL
              </th>
              <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                Total PnL
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <DesktopRow key={entry.symbol} entry={entry} />
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/* ---------- Desktop Table Row ---------- */

function DesktopRow({ entry }: { entry: LeaderboardEntry }) {
  const isTopThree = entry.rank <= 3;
  const rankColor =
    RANK_COLORS[entry.rank as keyof typeof RANK_COLORS] ?? undefined;

  return (
    <tr
      className="border-b border-border-subtle transition-colors last:border-b-0 hover:bg-bg-hover"
      style={
        isTopThree
          ? { borderLeftWidth: "3px", borderLeftColor: rankColor }
          : undefined
      }
    >
      {/* Rank */}
      <td className="px-5 py-4">
        <RankDisplay rank={entry.rank} />
      </td>

      {/* Token */}
      <td className="px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <span
            className="text-sm font-bold text-text-primary"
            style={isTopThree ? { color: rankColor } : undefined}
          >
            {entry.symbol}
          </span>
          <span className="text-xs text-text-muted">{entry.name}</span>
        </div>
      </td>

      {/* Total Signals */}
      <td className="px-5 py-4 text-right">
        <Badge variant="muted">{entry.totalSignals}</Badge>
      </td>

      {/* Win Rate */}
      <td className="px-5 py-4 text-right">
        <WinRateDisplay winRate={entry.winRate} />
      </td>

      {/* Avg PnL */}
      <td className="px-5 py-4 text-right">
        <PnlDisplay pnl={entry.avgPnl} />
      </td>

      {/* Total PnL */}
      <td className="px-5 py-4 text-right">
        <PnlDisplay pnl={entry.totalPnl} bold />
      </td>
    </tr>
  );
}

/* ---------- Mobile Cards ---------- */

function MobileCards({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {entries.map((entry) => (
        <MobileCard key={entry.symbol} entry={entry} />
      ))}
    </div>
  );
}

/* ---------- Mobile Card ---------- */

function MobileCard({ entry }: { entry: LeaderboardEntry }) {
  const isTopThree = entry.rank <= 3;
  const rankColor =
    RANK_COLORS[entry.rank as keyof typeof RANK_COLORS] ?? undefined;

  const PnlIcon = entry.totalPnl >= 0 ? TrendingUp : TrendingDown;
  const pnlIconColor =
    entry.totalPnl > 0
      ? "text-long-green"
      : entry.totalPnl < 0
        ? "text-short-red"
        : "text-text-muted";

  return (
    <Card
      className="transition-colors hover:border-brand-purple/30"
      style={
        isTopThree
          ? { borderLeftWidth: "3px", borderLeftColor: rankColor }
          : undefined
      }
    >
      <CardContent className="flex flex-col gap-4 p-5">
        {/* Top row: Rank + Token + PnL icon */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RankDisplay rank={entry.rank} />
            <div className="flex flex-col gap-0.5">
              <span
                className="text-sm font-bold text-text-primary"
                style={isTopThree ? { color: rankColor } : undefined}
              >
                {entry.symbol}
              </span>
              <span className="text-xs text-text-muted">{entry.name}</span>
            </div>
          </div>
          <PnlIcon className={`h-5 w-5 ${pnlIconColor}`} />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCell label="Total Signals" value={String(entry.totalSignals)} />
          <StatCell label="Win Rate">
            <WinRateDisplay winRate={entry.winRate} />
          </StatCell>
          <StatCell label="Avg PnL">
            <PnlDisplay pnl={entry.avgPnl} />
          </StatCell>
          <StatCell label="Total PnL">
            <PnlDisplay pnl={entry.totalPnl} bold />
          </StatCell>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Mobile Stat Cell ---------- */

function StatCell({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-bg-elevated px-3 py-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
        {label}
      </span>
      {children ?? (
        <span className="text-sm font-semibold tabular-nums text-text-primary">
          {value}
        </span>
      )}
    </div>
  );
}

/* ---------- Empty State ---------- */

function EmptyState() {
  return (
    <Card className="border-border-default">
      <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-elevated">
          <Trophy className="h-7 w-7 text-text-muted" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary">
          No Leaderboard Data
        </h3>
        <p className="max-w-sm text-sm text-text-secondary">
          The leaderboard is empty. Once signals are generated and outcomes
          are tracked, token rankings will appear here.
        </p>
      </CardContent>
    </Card>
  );
}

/* ---------- Loading Skeleton ---------- */

function LeaderboardSkeleton() {
  const SKELETON_ROW_COUNT = 8;

  return (
    <div className="flex flex-col gap-8 py-8 md:py-16">
      {/* Header skeleton */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-10 w-64" />
        </div>
        <Skeleton className="h-5 w-56" />
      </div>

      {/* Desktop table skeleton */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          {/* Table header */}
          <div className="flex items-center gap-4 border-b border-border-subtle px-5 py-4">
            <Skeleton className="h-4 w-6" />
            <Skeleton className="h-4 w-24" />
            <div className="ml-auto flex items-center gap-8">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>

          {/* Table rows */}
          {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-border-subtle px-5 py-4 last:border-b-0"
            >
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="flex flex-col gap-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="ml-auto flex items-center gap-8">
                <Skeleton className="h-5 w-10 rounded-full" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 w-14" />
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
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-5 w-5" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-12 rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
