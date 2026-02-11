import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPnl } from "@/lib/utils";
import Link from "next/link";
import { Radio, Activity, BarChart3, ArrowRight } from "lucide-react";

const API_BASE = process.env.API_URL || "http://localhost:3000";

interface PerformanceSnapshot {
  totalSignals: number;
  winRate: number;
  avgPnl: number;
}

const FALLBACK_STATS: PerformanceSnapshot = {
  totalSignals: 0,
  winRate: 0,
  avgPnl: 0,
};

async function fetchPerformance(): Promise<PerformanceSnapshot> {
  try {
    const res = await fetch(`${API_BASE}/signals/performance`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return FALLBACK_STATS;
    const data = await res.json();
    return {
      totalSignals: data.performance?.totalSignals ?? 0,
      winRate: data.performance?.winRate ?? 0,
      avgPnl: data.performance?.avgPnl ?? 0,
    };
  } catch {
    return FALLBACK_STATS;
  }
}

const FEATURES = [
  {
    icon: Radio,
    title: "Real-Time Signals",
    description:
      "AI-generated LONG and SHORT calls with entry, targets, and stop-loss levels updated every hour.",
    badge: "Live",
    badgeVariant: "long" as const,
  },
  {
    icon: Activity,
    title: "RSI Scanner",
    description:
      "Continuously scans the top 100 Solana tokens for oversold and overbought conditions using 14-period RSI.",
    badge: "100 Tokens",
    badgeVariant: "cyan" as const,
  },
  {
    icon: BarChart3,
    title: "Performance Tracking",
    description:
      "Every signal is scored against real outcomes. Win rate, PnL, and profit factor are tracked transparently.",
    badge: "Verified",
    badgeVariant: "default" as const,
  },
] as const;

export default async function HomePage() {
  const stats = await fetchPerformance();
  const hasData = stats.totalSignals > 0;

  return (
    <div className="flex flex-col gap-16 py-8 md:py-16">
      {/* ---------- Hero ---------- */}
      <section className="flex flex-col items-center gap-6 text-center">
        <Badge variant="cyan" className="text-sm">
          Solana Trading Companion
        </Badge>

        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
          <span className="bg-gradient-to-r from-brand-purple via-brand-purple-light to-brand-cyan bg-clip-text text-transparent">
            Trading Caller
          </span>
        </h1>

        <p className="max-w-xl text-lg text-text-secondary md:text-xl">
          AI-powered trading signals for Solana. Real technical analysis, real
          price data, real accountability.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/signals"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-purple px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-purple/25 transition-all hover:bg-brand-purple-light hover:shadow-brand-purple/40"
          >
            View Signals
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-bg-surface px-6 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-hover"
          >
            Open Dashboard
          </Link>
        </div>
      </section>

      {/* ---------- Stats Row ---------- */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Signals"
          value={hasData ? String(stats.totalSignals) : "--"}
        />
        <StatCard
          label="Win Rate"
          value={hasData ? `${stats.winRate.toFixed(1)}%` : "--"}
          accent={hasData && stats.winRate >= 50}
        />
        <StatCard
          label="Avg PnL"
          value={hasData ? formatPnl(stats.avgPnl) : "--"}
          accent={hasData && stats.avgPnl > 0}
        />
      </section>

      {/* ---------- Feature Cards ---------- */}
      <section className="flex flex-col gap-6">
        <h2 className="text-center text-2xl font-bold text-text-primary md:text-3xl">
          Built for Traders
        </h2>
        <p className="mx-auto max-w-lg text-center text-text-secondary">
          Everything you need to stay ahead of the Solana market, powered by
          real data and transparent scoring.
        </p>

        <div className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description, badge, badgeVariant }) => (
            <Card key={title} className="transition-colors hover:border-brand-purple/30">
              <CardContent className="flex flex-col gap-4 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-purple/15">
                    <Icon className="h-5 w-5 text-brand-purple-light" />
                  </div>
                  <Badge variant={badgeVariant}>{badge}</Badge>
                </div>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-lg font-semibold text-text-primary">
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    {description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------- Bottom CTA ---------- */}
      <section className="flex flex-col items-center gap-4 rounded-2xl border border-border-default bg-bg-surface p-8 text-center md:p-12">
        <h2 className="text-2xl font-bold text-text-primary md:text-3xl">
          Ready to trade smarter?
        </h2>
        <p className="max-w-md text-text-secondary">
          Explore live signals, scan RSI levels across 100 tokens, and track
          every call against real outcomes.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/signals"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-purple px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-purple/25 transition-all hover:bg-brand-purple-light hover:shadow-brand-purple/40"
          >
            Browse Signals
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/market"
            className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-bg-elevated px-6 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-hover"
          >
            RSI Scanner
            <Activity className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ---------- Stat Card ---------- */

function StatCard({
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
      <CardContent className="flex flex-col items-center gap-1 p-6">
        <span className="text-sm font-medium text-text-muted">{label}</span>
        <span
          className={`text-3xl font-bold tabular-nums ${
            accent ? "text-long-green" : "text-text-primary"
          }`}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );
}
