import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trading Caller — AI Solana Trading Signals",
  description:
    "Real-time AI trading signals for Solana tokens with RSI scanning, volume analysis, and performance tracking.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg-primary antialiased">
        <Nav />
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        <footer className="border-t border-border-default py-6 text-center text-sm text-text-muted">
          Trading Caller &mdash; AI-powered Solana trading companion
        </footer>
      </body>
    </html>
  );
}
