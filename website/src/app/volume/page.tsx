"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  ExternalLink,
  Activity,
} from "lucide-react";

/* ---------- Types ---------- */

interface VolumeToken {
  symbol: string;
  name: string;
  address: string;
  volume1h: number;
  volume24h: number;
  priceChange1h: number;
}

interface VolumeSpikeToken {
  symbol: string;
  name: string;
  address: string;
}

interface VolumeSpike {
  id: string;
  token: VolumeSpikeToken;
  volumeSpikeMultiple: number;
  volumeSpikePercent: number;
  currentVolume1h: number;
  avgHourlyVolume: number;
  priceUsd: number;
  priceChange1h: number;
  priceChange24h: number;
  buySellRatio: number;
  volumeVelocity: number;
  spikeType: "BULLISH" | "BEARISH" | "NEUTRAL";
  severity: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  detectedAt: string;
  dexScreenerUrl?: string;
}

interface TopVolumeResponse {
  success: boolean;
  count: number;
  tokens: VolumeToken[];
}

interface SpikesResponse {
  success: boolean;
  count: number;
  spikes: VolumeSpike[];
}

/* ---------- Constants ---------- */

const POLL_INTERVAL_MS = 60_000;
const SKELETON_SPIKE_COUNT = 3;
const SKELETON_ROW_COUNT = 8;

const SEVERITY_CONFIG = {
  LOW: {
    badge: "muted" as const,
    label: "Low",
    iconColor: "text-text-muted",
    borderColor: "border-border-default",
    bgAccent: "bg-bg-elevated",
  },
  MEDIUM: {
    badge: "warning" as const,
    label: "Medium",
    iconColor: "text-yellow-400",
    borderColor: "border-yellow-500/30",
    bgAccent: "bg-yellow-500/10",
  },
  HIGH: {
    badge: "short" as const,
    label: "High",
    iconColor: "text-short-red",
    borderColor: "border-short-red/30",
    bgAccent: "bg-short-red-dim",
  },
  EXTREME: {
    badge: "short" as const,
    label: "Extreme",
    iconColor: "text-short-red",
    borderColor: "border-short-red/50",
    bgAccent: "bg-short-red-dim",
  },
} as const;

const SPIKE_TYPE_CONFIG = {
  BULLISH: { badge: "long" as const, label: "Bullish" },
  BEARISH: { badge: "short" as const, label: "Bearish" },
  NEUTRAL: { badge: "muted" as const, label: "Neutral" },
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
          if (topData.success) setTokens(topData.tokens ?? []);
        }

        if (spikesRes.ok) {
          const spikesData: SpikesResponse = await spikesRes.json();
          if (spikesData.success) setSpikes(spikesData.spikes ?? []);
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

  const highExtremeCount = spikes.filter(
    (s) => s.severity === "HIGH" || s.severity === "EXTREME",
  ).length;

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
          value={String(highExtremeCount)}
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
              <SpikeCard key={spike.id} spike={spike} />
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
  const severityKey = spike.severity ?? "LOW";
  const config = SEVERITY_CONFIG[severityKey] ?? SEVERITY_CONFIG.LOW;
  const spikeTypeKey = spike.spikeType ?? "NEUTRAL";
  const spikeTypeConfig =
    SPIKE_TYPE_CONFIG[spikeTypeKey] ?? SPIKE_TYPE_CONFIG.NEUTRAL;

  const isPositiveChange1h = (spike.priceChange1h ?? 0) >= 0;
  const isPositiveChange24h = (spike.priceChange24h ?? 0) >= 0;
  const isExtreme = severityKey === "EXTREME";

  const symbol = spike.token?.symbol ?? "???";
  const name = spike.token?.name ?? "Unknown";

  const buySellPercent =
    spike.buySellRatio != null
      ? (spike.buySellRatio * 100).toFixed(0)
      : null;
  const isBuyDominant = (spike.buySellRatio ?? 0) >= 0.5;

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
              <CardTitle className="text-base">{symbol}</CardTitle>
              <span className="max-w-[140px] truncate text-xs text-text-muted">
                {name}
              </span>
            </div>
          </div>

          {/* Severity + spike type badges */}
          <div className="flex items-center gap-1.5">
            <Badge
              variant={spikeTypeConfig.badge}
              className="text-[10px]"
            >
              {spikeTypeConfig.label}
            </Badge>
            <Badge
              variant={config.badge}
              className={isExtreme ? "animate-pulse" : ""}
            >
              {config.label}
            </Badge>
          </div>
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
              {(spike.volumeSpikeMultiple ?? 0).toFixed(1)}x{" "}
              <span className="text-xs font-normal text-text-muted">
                avg ({(spike.volumeSpikePercent ?? 0).toFixed(0)}%)
              </span>
            </span>
          </div>
        </div>

        {/* Volume details row */}
        <div className="flex items-center justify-between rounded-lg bg-bg-elevated px-3 py-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Current 1h Vol
            </span>
            <span className="text-sm font-semibold tabular-nums text-text-primary">
              ${formatNumber(spike.currentVolume1h ?? 0)}
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Avg Hourly
            </span>
            <span className="text-sm font-semibold tabular-nums text-text-secondary">
              ${formatNumber(spike.avgHourlyVolume ?? 0)}
            </span>
          </div>
        </div>

        {/* Price + change rows */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Price
            </span>
            <span className="text-sm font-semibold tabular-nums text-text-primary">
              ${formatPrice(spike.priceUsd ?? 0)}
            </span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              1h
            </span>
            <span
              className={`inline-flex items-center gap-1 text-sm font-semibold tabular-nums ${
                isPositiveChange1h ? "text-long-green" : "text-short-red"
              }`}
            >
              {isPositiveChange1h ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {isPositiveChange1h ? "+" : ""}
              {(spike.priceChange1h ?? 0).toFixed(2)}%
            </span>
          </div>

          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              24h
            </span>
            <span
              className={`inline-flex items-center gap-1 text-sm font-semibold tabular-nums ${
                isPositiveChange24h ? "text-long-green" : "text-short-red"
              }`}
            >
              {isPositiveChange24h ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {isPositiveChange24h ? "+" : ""}
              {(spike.priceChange24h ?? 0).toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Buy/Sell ratio + Volume velocity */}
        <div className="flex items-center justify-between rounded-lg bg-bg-elevated px-3 py-2">
          {buySellPercent != null && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                Buy/Sell
              </span>
              <span
                className={`text-sm font-semibold tabular-nums ${
                  isBuyDominant ? "text-long-green" : "text-short-red"
                }`}
              >
                {buySellPercent}% {isBuyDominant ? "buy" : "sell"}
              </span>
            </div>
          )}
          {spike.volumeVelocity != null && (
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                Velocity
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-brand-cyan">
                <Activity className="h-3 w-3" />
                {spike.volumeVelocity.toFixed(2)}x
              </span>
            </div>
          )}
        </div>

        {/* Footer: detected time + DexScreener link */}
        <div className="flex items-center justify-between border-t border-border-default pt-2">
          <span className="text-xs text-text-muted">
            Detected {timeAgo(spike.detectedAt)}
          </span>
          {spike.dexScreenerUrl && (
            <a
              href={spike.dexScreenerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-cyan transition-colors hover:text-brand-purple"
            >
              DexScreener
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
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
                1h Volume
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                24h Volume
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                1h Price Change
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
  const isPositivePriceChange = (token.priceChange1h ?? 0) >= 0;

  return (
    <tr className="transition-colors hover:bg-bg-hover/50">
      {/* Token identity */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-elevated">
            <span className="text-xs font-bold text-text-secondary">
              {token.symbol?.slice(0, 2) ?? "??"}
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

      {/* 1h volume */}
      <td className="px-5 py-3.5 text-right">
        <span className="text-sm font-semibold tabular-nums text-text-primary">
          ${formatNumber(token.volume1h ?? 0)}
        </span>
      </td>

      {/* 24h volume */}
      <td className="px-5 py-3.5 text-right">
        <span className="text-sm font-semibold tabular-nums text-text-primary">
          ${formatNumber(token.volume24h ?? 0)}
        </span>
      </td>

      {/* 1h price change */}
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
          {(token.priceChange1h ?? 0).toFixed(2)}%
        </span>
      </td>
    </tr>
  );
}

/* ---------- Mobile Volume Card ---------- */

function VolumeMobileCard({ token }: { token: VolumeToken }) {
  const isPositivePriceChange = (token.priceChange1h ?? 0) >= 0;

  return (
    <Card className="transition-colors hover:border-brand-purple/30">
      <CardContent className="flex flex-col gap-3 p-4">
        {/* Top row: token identity */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-elevated">
              <span className="text-xs font-bold text-text-secondary">
                {token.symbol?.slice(0, 2) ?? "??"}
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
              ${formatNumber(token.volume24h ?? 0)}
            </span>
          </div>
        </div>

        {/* Bottom row: 1h volume + 1h price change */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-text-muted">1h Vol</span>
            <span className="text-sm font-semibold tabular-nums text-text-primary">
              ${formatNumber(token.volume1h ?? 0)}
            </span>
          </div>

          <div className="flex flex-col items-end gap-0.5">
            <span className="text-xs text-text-muted">1h Change</span>
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
              {(token.priceChange1h ?? 0).toFixed(2)}%
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
                <Skeleton className="h-12 w-full rounded-lg" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-10 w-20" />
                  <Skeleton className="h-10 w-16" />
                  <Skeleton className="h-10 w-16" />
                </div>
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-3 w-full" />
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
                    <Skeleton className="ml-auto h-3 w-16" />
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
                      <Skeleton className="ml-auto h-4 w-20" />
                    </td>
                    <td className="px-5 py-3.5">
                      <Skeleton className="ml-auto h-4 w-16" />
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
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
