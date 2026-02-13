# Frontend Revamp Design — Trading Caller

**Date:** February 13, 2026
**Status:** Approved
**Spec:** `design-specification.md` (v2.0)

---

## Context

The current Trading Caller frontend is a dark-themed trading dashboard (Next.js 15, React 19, Tailwind 4) deployed at https://website-nine-rho-35.vercel.app. It has 7 pages: Home, Dashboard, Signals, RSI Scanner, Volume, Leaderboard, and Backtest.

The existing `design-specification.md` (v1.0) described an Aave-style marketing landing page with light theme, geometric illustrations, and DeFi protocol sections — none of which matched the actual product.

## Decision

Full rewrite of `design-specification.md` (now v2.0) to serve as the single source of truth for both:

1. **Marketing landing page** at `/` — replaces the current homepage
2. **Redesigned dashboard pages** — all existing pages get a light theme treatment

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Theme | Light throughout | User preference. Clean, legible, modern SaaS feel. |
| Visual style | Typography-driven, minimal | Fast to implement. Strong typographic hierarchy carries the design. No custom illustrations needed. |
| Landing page content | Product-focused | Hero → Features → How It Works → Performance Proof → FAQ → CTA. Shows what Trading Caller actually does. |
| Route structure | Replace homepage | `/` becomes marketing landing. Dashboard pages stay at current routes. Shared nav bridges both. |
| Brand accent | Keep `#7B61FF` purple | Continuity with existing brand. Works well on both light and dark contexts. |
| Fonts | Keep Inter + JetBrains Mono | Already in use. Inter for UI, JetBrains Mono for prices/data — perfect for a trading tool. |

## What Changes

### Landing Page (New)
- Hero with "Trade Solana with real signals, not guesses." headline
- 4 feature cards (Signals, RSI Scanner, Volume Tracker, Backtesting)
- 3-step "How It Works" section
- Performance Proof section with live API data
- FAQ accordion (4 items)
- Bottom CTA + footer

### Dashboard Pages (Redesigned)
- All backgrounds flip from dark (`#0E0E10`) to white (`#FFFFFF`)
- Cards get `#F8F9FA` backgrounds with visible `#E5E7EB` borders
- Data tables get alternating row striping for readability
- Metric cards get colored left-border accents (green/red/purple)
- Skeleton loaders recolored to `#F0F1F3`
- Long/Short colors adjusted for light background contrast

### Shared
- Navigation bar: same across all pages, sticky, transparent→white on scroll
- Footer: consistent across all routes
- Active nav link: filled purple pill background

## What Stays the Same

- All 7 routes and their data/functionality
- Component library (Card, Badge, Button, Skeleton, Table, Tabs)
- API client and data fetching patterns
- Auto-refresh polling (30-60s intervals)
- Responsive breakpoints (desktop tables → mobile cards)
- Loading/error state patterns

## Source of Truth

All design tokens, component specs, interaction patterns, and accessibility requirements are documented in `design-specification.md` v2.0 at the project root.

---

*Next step: Create implementation plan using writing-plans skill.*