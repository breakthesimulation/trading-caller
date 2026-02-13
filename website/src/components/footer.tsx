import Link from "next/link";

const PRODUCT_LINKS = [
  { href: "/signals", label: "Live Signals" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/market", label: "RSI Scanner" },
  { href: "/volume", label: "Volume Tracker" },
];

const RESOURCE_LINKS = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/backtest", label: "Backtesting" },
];

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-[1200px] px-4 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          {/* Logo — wordmark placeholder */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              {/* Wordmark placeholder — replace with <Image> when assets are ready */}
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white">
                AF
              </div>
              <span className="text-base font-bold text-primary">
                Agent Fox
              </span>
            </div>
            <p className="max-w-xs text-sm text-text-secondary">
              AI-powered trading signals for the Solana ecosystem.
            </p>
          </div>

          {/* Link columns */}
          <div className="flex gap-16">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Product
              </span>
              {PRODUCT_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-sm text-text-secondary transition-colors hover:text-primary hover:underline"
                >
                  {label}
                </Link>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Resources
              </span>
              {RESOURCE_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-sm text-text-secondary transition-colors hover:text-primary hover:underline"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom line */}
        <div className="mt-10 border-t border-border pt-6">
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} Agent Fox. Not financial
            advice. All signals are for informational purposes only.
          </p>
        </div>
      </div>
    </footer>
  );
}
