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
import { formatPrice, formatNumber, timeAgo } from "@/lib/utils";
import {
  TrendingUp,
  Zap,
  BarChart3,
  AlertTriangle,
  Volume2,
  TrendingDown,
  RefreshCw,
} from "lucide-react";

/* ---------- Types ---------- */

interface VolumeToken {
  symbol: string;
  name: string;
  volume24h: number;
  volumeChange: number;
  price: number;
  priceChange24h: number;
}

interface VolumeSpike {
  symbol: string;
  name: string;
  severity: "low" | "medium" | "high" | "extreme";
  volumeMultiplier: number;
  price: number;
  priceChange: number;
  detectedAt: string;
}

interface TopVolumeResponse {
  success: boolean;
  tokens: VolumeToken[];
}

interface SpikesResponse {
  success: boolean;
  spikes: VolumeSpike[];
}

/* ---------- Constants ---------- */

const POLL_INTERVAL_MS = 60_000;
const SKELETON_SPIKE_COUNT = 3;
const SKELETON_ROW_COUNT = 8;

const SEVERITY_CONFIG = {
  low: {
    badge: "muted" as const,
    label: "Low",
    iconColor: "text-text-muted",
    borderColor: "border-border-default",
    bgAccent: "bg-bg-elevated",
  },
  medium: {
    badge: "warning" as const,
    label: "Medium",
    iconColor: "text-yellow-400",
    borderColor: "border-yellow-500/30",
    bgAccent: "bg-yellow-500/10",
  },
  high: {
    badge: "short" as const,
    label: "High",
    iconColor: "text-short-red",
    borderColor: "border-short-red/30",
    bgAccent: "bg-short-red-dim",
  },
  extreme: {
    badge: "short" as const,
    label: "Extreme",
    iconColor: "text-short-red",
    borderColor: "border-short-red/50",
    bgAccent: "bg-short-red-dim",
  },
} as const;

/* ---------- Page Component ---------- */

export default function VolumePage() {
  const [tokens, setTokens] = useState<VolumeToken[]>([]);
  const [spikes, setSpikes] = useState<VolumeSpike[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchVolumeData = useCallback(
    async (showRefreshSpinner = false) => {
      if (showRefreshSpinner) setRefreshing(true);

      try {
        const [topRes, spikesRes] = await Promise.all([
          fetch("/api/volume/top"),
          fetch("/api/volume/spikes"),
        ]);

        if (topRes.ok) {
          const topData: TopVolumeResponse = await topRes.json();
          if (topData.success) setTokens(topData.tokens);
        }

        if (spikesRes.ok) {
          const spikesData: SpikesResponse = await spikesRes.json();
          if (spikesData.success) setSpikes(spikesData.spikes);
        }

        setLastUpdated(new Date());
      } catch {
        /* Silently fail on poll -- keep stale data visible */
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  /* Initial fetch + poll every 60s */
  useEffect(() => {
    fetchVolumeData();

    const interval = setInterval(() => fetchVolumeData(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchVolumeData]);

  /* ---------- Manual refresh ---------- */

  function handleRefresh() {
    fetchVolumeData(true);
  }

  /* ---------- Loading skeleton ---------- */

  if (loading) {
    return <VolumeSkeleton />;
  }

  /* ---------- Render ---------- */

  return (
    <div className="flex flex-col gap-8 py-8 md:py-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-text-primary md:text-4xl">
              Volume Scanner
            </h1>
            <Badge variant="cyan">
              <Volume2 className="mr-1 h-3 w-3" />
              Live
            </Badge>
          </div>
          <p className="text-text-secondary">
            Track unusual volume activity and spikes across Solana tokens
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

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={BarChart3}
          label="Tokens Tracked"
          value={String(tokens.length)}
          accentBg="bg-brand-purple/15"
          accentText="text-brand-purple-light"
        />
        <SummaryCard
          icon={Zap}
          label="Active Spikes"
          value={String(spikes.length)}
          accentBg="bg-yellow-500/15"
          accentText="text-yellow-400"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="High / Extreme"
          value={String(
            spikes.filter(
              (s) => s.severity === "high" || s.severity === "extreme",
            ).length,
          )}
          subtitle="Require attention"
          accentBg="bg-short-red-dim"
          accentText="text-short-red"
        />
      </div>

      {/* Volume Spikes Section */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/15">
            <Zap className="h-4 w-4 text-yellow-400" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-text-primary">
              Volume Spikes
            </h2>
            <p className="text-xs text-text-muted">
              Tokens with abnormal volume activity
            </p>
          </div>
        </div>

        {spikes.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No Volume Spikes"
            description="No unusual volume activity detected. The scanner checks every minute for sudden volume changes."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {spikes.map((spike) => (
              <SpikeCard key={`${spike.symbol}-${spike.detectedAt}`} spike={spike} />
            ))}
          </div>
        )}
      </section>

      {/* Top Volume Section */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-purple/15">
            <BarChart3 className="h-4 w-4 text-brand-purple-light" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-text-primary">
              Top Volume
            </h2>
            <p className="text-xs text-text-muted">
              Tokens ranked by 24-hour trading volume
            </p>
          </div>
        </div>

        {tokens.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No Volume Data"
            description="Volume data is not available yet. Check back shortly as the scanner collects data."
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <VolumeTable tokens={tokens} />
            </div>

            {/* Mobile card grid */}
            <div className="flex flex-col gap-3 md:hidden">
              {tokens.map((token) => (
                <VolumeMobileCard key={token.symbol} token={token} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/* ================================================================
   Sub-components
   ================================================================ */

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

/* ---------- Spike Card ---------- */

function SpikeCard({ spike }: { spike: VolumeSpike }) {
  const config = SEVERITY_CONFIG[spike.severity];
  const isPositiveChange = spike.priceChange >= 0;
  const isExtreme = spike.severity === "extreme";

  return (
    <Card
      className={`transition-colors ${config.borderColor} hover:border-brand-purple/30`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          {/* Token identity */}
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${config.bgAccent}`}
            >
              <AlertTriangle
                className={`h-5 w-5 ${config.iconColor} ${
                  isExtreme ? "animate-pulse" : ""
                }`}
              />
            </div>
            <div className="flex flex-col">
              <CardTitle className="text-base">{spike.symbol}</CardTitle>
              <span className="max-w-[140px] truncate text-xs text-text-muted">
                {spike.name}
              </span>
            </div>
          </div>

          {/* Severity badge */}
          <Badge
            variant={config.badge}
            className={isExtreme ? "animate-pulse" : ""}
          >
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {/* Volume multiplier */}
        <div className="flex items-center gap-2 rounded-lg bg-bg-elevated px-3 py-2">
          <Volume2 className="h-4 w-4 shrink-0 text-brand-cyan" />
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Volume Spike
            </span>
            <span className="text-lg font-bold tabular-nums text-brand-cyan">
              {spike.volumeMultiplier.toFixed(1)}x{" "}
              <span className="text-xs font-normal text-text-muted">avg</span>
            </span>
          </div>
        </div>

        {/* Price + change row */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Price
            </span>
            <span className="text-sm font-semibold tabular-nums text-text-primary">
              ${formatPrice(spike.price)}
            </span>
          </div>

          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Change
            </span>
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
              {spike.priceChange.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Detected time */}
        <div className="flex items-center justify-end border-t border-border-default pt-2">
          <span className="text-xs text-text-muted">
            Detected {timeAgo(spike.detectedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Desktop Volume Table ---------- */

function VolumeTable({ tokens }: { tokens: VolumeToken[] }) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default">
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                Token
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                24h Volume
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                Volume Change
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                Price
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                24h Price Change
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {tokens.map((token) => (
              <VolumeTableRow key={token.symbol} token={token} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------- Volume Table Row ---------- */

function VolumeTableRow({ token }: { token: VolumeToken }) {
  const isPositiveVolumeChange = token.volumeChange >= 0;
  const isPositivePriceChange = token.priceChange24h >= 0;

  return (
    <tr className="transition-colors hover:bg-bg-hover/50">
      {/* Token identity */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-elevated">
            <span className="text-xs font-bold text-text-secondary">
              {token.symbol.slice(0, 2)}
            </span>
          </div>
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

      {/* 24h volume */}
      <td className="px-5 py-3.5 text-right">
        <span className="text-sm font-semibold tabular-nums text-text-primary">
          ${formatNumber(token.volume24h)}
        </span>
      </td>

      {/* Volume change */}
      <td className="px-5 py-3.5 text-right">
        <span
          className={`inline-flex items-center justify-end gap-1 text-sm font-semibold tabular-nums ${
            isPositiveVolumeChange ? "text-long-green" : "text-short-red"
          }`}
        >
          {isPositiveVolumeChange ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          {isPositiveVolumeChange ? "+" : ""}
          {token.volumeChange.toFixed(2)}%
        </span>
      </td>

      {/* Price */}
      <td className="px-5 py-3.5 text-right">
        <span className="text-sm font-semibold tabular-nums text-text-primary">
          ${formatPrice(token.price)}
        </span>
      </td>

      {/* 24h price change */}
      <td className="px-5 py-3.5 text-right">
        <span
          className={`inline-flex items-center justify-end gap-1 text-sm font-semibold tabular-nums ${
            isPositivePriceChange ? "text-long-green" : "text-short-red"
          }`}
        >
          {isPositivePriceChange ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          {isPositivePriceChange ? "+" : ""}
          {token.priceChange24h.toFixed(2)}%
        </span>
      </td>
    </tr>
  );
}

/* ---------- Mobile Volume Card ---------- */

function VolumeMobileCard({ token }: { token: VolumeToken }) {
  const isPositiveVolumeChange = token.volumeChange >= 0;
  const isPositivePriceChange = token.priceChange24h >= 0;

  return (
    <Card className="transition-colors hover:border-brand-purple/30">
      <CardContent className="flex flex-col gap-3 p-4">
        {/* Top row: token identity */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-elevated">
              <span className="text-xs font-bold text-text-secondary">
                {token.symbol.slice(0, 2)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-text-primary">
                {token.symbol}
              </span>
              <span className="max-w-[140px] truncate text-xs text-text-muted">
                {token.name}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              24h Vol
            </span>
            <span className="text-sm font-bold tabular-nums text-text-primary">
              ${formatNumber(token.volume24h)}
            </span>
          </div>
        </div>

        {/* Bottom row: volume change, price, price change */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-text-muted">Vol Change</span>
            <span
              className={`inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums ${
                isPositiveVolumeChange ? "text-long-green" : "text-short-red"
              }`}
            >
              {isPositiveVolumeChange ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {isPositiveVolumeChange ? "+" : ""}
              {token.volumeChange.toFixed(2)}%
            </span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs text-text-muted">Price</span>
            <span className="text-sm font-semibold tabular-nums text-text-primary">
              ${formatPrice(token.price)}
            </span>
          </div>

          <div className="flex flex-col items-end gap-0.5">
            <span className="text-xs text-text-muted">24h</span>
            <span
              className={`inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums ${
                isPositivePriceChange ? "text-long-green" : "text-short-red"
              }`}
            >
              {isPositivePriceChange ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {isPositivePriceChange ? "+" : ""}
              {token.priceChange24h.toFixed(2)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Empty State ---------- */

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Card className="border-border-default">
      <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-elevated">
          <Icon className="h-7 w-7 text-text-muted" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
        <p className="max-w-sm text-sm text-text-secondary">{description}</p>
      </CardContent>
    </Card>
  );
}

/* ---------- Loading Skeleton ---------- */

function VolumeSkeleton() {
  return (
    <div className="flex flex-col gap-8 py-8 md:py-16">
      {/* Header skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-5 w-80" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
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

      {/* Spikes section skeleton */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-52" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: SKELETON_SPIKE_COUNT }).map((_, i) => (
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
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Skeleton className="h-14 w-full rounded-lg" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-10 w-20" />
                  <Skeleton className="h-10 w-20" />
                </div>
                <Skeleton className="h-3 w-24 self-end" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Top volume section skeleton */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-60" />
          </div>
        </div>

        {/* Desktop table skeleton */}
        <Card className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="px-5 py-3.5 text-left">
                    <Skeleton className="h-3 w-12" />
                  </th>
                  <th className="px-5 py-3.5 text-right">
                    <Skeleton className="ml-auto h-3 w-16" />
                  </th>
                  <th className="px-5 py-3.5 text-right">
                    <Skeleton className="ml-auto h-3 w-20" />
                  </th>
                  <th className="px-5 py-3.5 text-right">
                    <Skeleton className="ml-auto h-3 w-10" />
                  </th>
                  <th className="px-5 py-3.5 text-right">
                    <Skeleton className="ml-auto h-3 w-20" />
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
                      <Skeleton className="ml-auto h-4 w-20" />
                    </td>
                    <td className="px-5 py-3.5">
                      <Skeleton className="ml-auto h-4 w-16" />
                    </td>
                    <td className="px-5 py-3.5">
                      <Skeleton className="ml-auto h-4 w-16" />
                    </td>
                    <td className="px-5 py-3.5">
                      <Skeleton className="ml-auto h-4 w-14" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Mobile card skeleton */}
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
                  <Skeleton className="h-8 w-20" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-14" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
