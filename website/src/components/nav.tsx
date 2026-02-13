"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Activity,
  Radio,
  TrendingUp,
  LineChart,
  Menu,
  X,
  BarChart3,
} from "lucide-react";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { href: "/signals", label: "Signals", icon: Radio },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/market", label: "RSI Scanner", icon: Activity },
  { href: "/volume", label: "Volume", icon: TrendingUp },
];

export function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 10);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-200",
        scrolled
          ? "bg-white/95 backdrop-blur-lg border-b border-border shadow-sm"
          : "bg-transparent"
      )}
      role="banner"
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4">
        {/* Logo — left */}
        <Link href="/" className="flex items-center gap-2.5">
          <LineChart className="h-6 w-6 text-accent" />
          <span className="text-lg font-bold text-primary">
            Trading Caller
          </span>
        </Link>

        {/* Desktop nav — center */}
        <nav
          className="hidden items-center gap-1 md:flex"
          role="navigation"
          aria-label="Main navigation"
        >
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-primary hover:bg-bg-elevated"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* CTA — right (desktop) */}
        <div className="hidden md:block">
          <Link
            href="/signals"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-md"
          >
            Open App
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-text-secondary hover:bg-bg-elevated md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Mobile nav — full-screen overlay */}
      {mobileOpen && (
        <nav
          className="fixed inset-0 top-16 z-40 bg-white px-4 py-6 md:hidden"
          role="navigation"
          aria-label="Mobile navigation"
        >
          <div className="flex flex-col gap-2">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                aria-current={pathname === href ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors",
                  pathname === href
                    ? "bg-accent text-white"
                    : "text-text-secondary hover:bg-bg-elevated hover:text-primary"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            ))}
            <div className="mt-4 border-t border-border pt-4">
              <Link
                href="/signals"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-base font-semibold text-white transition-all hover:bg-accent-light"
              >
                Open App
                <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
