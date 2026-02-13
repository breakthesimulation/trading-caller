import Link from "next/link";
import Image from "next/image";

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
              <Image
                src="/agent-fox-monogram.jpeg"
                alt="Agent Fox logo"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-base font-bold text-primary">
                Agent Fox
              </span>
            </div>
            <p className="max-w-xs text-sm text-text-secondary">
              AI-powered trading signals for the Solana ecosystem.
            </p>
            <a
              href="https://x.com/AgentAIFox"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-2 text-sm text-text-secondary transition-colors hover:text-primary"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              Follow on X
            </a>
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
