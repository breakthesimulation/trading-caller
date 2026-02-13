import { Badge } from "@/components/ui/badge";
import { formatPnl } from "@/lib/utils";
import Link from "next/link";
import {
  Radio,
  Activity,
  BarChart3,
  FlaskConical,
  ArrowRight,
  Target,
  Zap,
  LineChart,
} from "lucide-react";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { FaqSection } from "@/components/landing/faq-section";

const API_BASE = process.env.API_URL || "http://localhost:3000";

interface PerformanceSnapshot {
  totalSignals: number;
  winRate: number;
  avgPnl: number;
  profitFactor: number;
  totalPnl: number;
}

const FALLBACK_STATS: PerformanceSnapshot = {
  totalSignals: 0,
  winRate: 0,
  avgPnl: 0,
  profitFactor: 0,
  totalPnl: 0,
};

async function fetchPerformance(): Promise<PerformanceSnapshot> {
  try {
    const res = await fetch(`${API_BASE}/signals/performance`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return FALLBACK_STATS;
    const data = await res.json();
    const perf = data.performance;
    return {
      totalSignals: perf?.summary?.total ?? 0,
      winRate: parseFloat(perf?.rates?.winRate) || 0,
      avgPnl: parseFloat(perf?.pnl?.average) || 0,
      profitFactor: parseFloat(perf?.pnl?.profitFactor) || 0,
      totalPnl: parseFloat(perf?.pnl?.total) || 0,
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
      "LONG and SHORT calls with entry, targets, and stop-loss levels. Updated hourly.",
  },
  {
    icon: Activity,
    title: "RSI Scanner",
    description:
      "Scans top 100 Solana tokens for oversold and overbought conditions across 4 timeframes.",
  },
  {
    icon: BarChart3,
    title: "Volume Tracker",
    description:
      "Detects volume spikes and anomalies before price moves. Severity-ranked alerts.",
  },
  {
    icon: FlaskConical,
    title: "Backtesting",
    description:
      "Every strategy tested against historical data. Profit factor, drawdown, Sharpe ratio.",
  },
] as const;

const HOW_IT_WORKS = [
  {
    step: 1,
    title: "Scan",
    description:
      "Continuously monitors 100+ Solana tokens for technical setups.",
  },
  {
    step: 2,
    title: "Analyze",
    description:
      "Calculates RSI, MACD, support/resistance, and volume confluence.",
  },
  {
    step: 3,
    title: "Signal",
    description:
      "Generates actionable calls with entry, targets, and stop-loss levels.",
  },
] as const;

export default async function HomePage() {
  const stats = await fetchPerformance();
  const hasData = stats.totalSignals > 0;

  return (
    <div className="flex flex-col">
      {/* ---------- Hero ---------- */}
      <section className="flex flex-col items-center gap-6 pb-20 pt-24 text-center md:pt-32">
        <Badge variant="default" className="text-sm">
          AI-Powered
        </Badge>

        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-primary md:text-[56px] md:leading-[1.1]">
          Trade Solana with real signals, not guesses.
        </h1>

        <p className="max-w-2xl text-lg leading-relaxed text-text-secondary">
          AI-generated LONG and SHORT calls backed by real technical analysis.
          Every signal tracked, scored, and verified against actual outcomes.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Link
            href="/signals"
            className="group inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-accent-light hover:shadow-lg"
          >
            View Live Signals
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-bg-secondary"
          >
            Open Dashboard
          </Link>
        </div>

        {/* Live stat counters */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-8 md:gap-12">
          <StatCounter
            label="Total Signals"
            value={hasData ? String(stats.totalSignals) : "--"}
          />
          <StatCounter
            label="Win Rate"
            value={hasData ? `${stats.winRate.toFixed(1)}%` : "--"}
          />
          <StatCounter
            label="Avg PnL"
            value={hasData ? formatPnl(stats.avgPnl) : "--"}
          />
        </div>
      </section>

      {/* ---------- Feature Showcase ---------- */}
      <ScrollReveal>
        <section className="py-20">
          <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="text-3xl font-bold text-primary md:text-4xl">
              Built for traders who want an edge.
            </h2>
            <p className="max-w-lg text-text-secondary">
              Real data, real analysis, real accountability.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group flex flex-col gap-4 rounded-xl border border-border bg-bg-secondary p-8 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="text-xl font-semibold text-primary">{title}</h3>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* ---------- How It Works ---------- */}
      <ScrollReveal>
        <section className="py-20">
          <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="text-3xl font-bold text-primary md:text-4xl">
              From scan to signal in seconds.
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map(({ step, title, description }) => (
              <div key={step} className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-xl font-bold text-accent">
                  {step}
                </div>
                <h3 className="text-lg font-semibold text-primary">{title}</h3>
                <p className="max-w-xs text-sm leading-relaxed text-text-secondary">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* ---------- Performance Proof ---------- */}
      <ScrollReveal>
        <section className="py-20">
          <div className="rounded-xl border border-border bg-bg-secondary p-8 md:p-12">
            <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-16">
              {/* Left text */}
              <div className="flex flex-col gap-4 md:w-1/2">
                <h2 className="text-3xl font-bold text-primary md:text-4xl">
                  Every call. Tracked. Scored. Transparent.
                </h2>
                <p className="text-text-secondary leading-relaxed">
                  No cherry-picked results. Every signal is scored against real
                  market outcomes at 24h, 48h, and 7d intervals.
                </p>
              </div>

              {/* Right metrics */}
              <div className="grid grid-cols-2 gap-6 md:w-1/2">
                <MetricBlock
                  label="Win Rate"
                  value={hasData ? `${stats.winRate.toFixed(1)}%` : "--"}
                />
                <MetricBlock
                  label="Total PnL"
                  value={hasData ? formatPnl(stats.totalPnl) : "--"}
                />
                <MetricBlock
                  label="Profit Factor"
                  value={hasData ? stats.profitFactor.toFixed(2) : "--"}
                />
                <MetricBlock
                  label="Signals Tracked"
                  value={hasData ? String(stats.totalSignals) : "--"}
                />
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ---------- FAQ ---------- */}
      <ScrollReveal>
        <FaqSection />
      </ScrollReveal>

      {/* ---------- Bottom CTA ---------- */}
      <ScrollReveal>
        <section className="mb-8 rounded-xl bg-bg-secondary py-20 text-center">
          <div className="mx-auto flex max-w-lg flex-col items-center gap-6">
            <h2 className="text-3xl font-bold text-primary md:text-4xl">
              Ready to trade smarter?
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signals"
                className="group inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-accent-light hover:shadow-lg"
              >
                Browse Live Signals
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/market"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-bg-secondary"
              >
                <Activity className="h-4 w-4" />
                RSI Scanner
              </Link>
            </div>
          </div>
        </section>
      </ScrollReveal>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function StatCounter({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-2xl font-bold tabular-nums text-primary md:text-3xl">
        {value}
      </span>
      <span className="text-xs font-medium text-text-muted">{label}</span>
    </div>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <span className="text-2xl font-bold tabular-nums text-primary">
        {value}
      </span>
    </div>
  );
}
