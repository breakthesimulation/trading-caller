# Trading Caller — UI/UX Design Specification

**Version:** 2.0
**Date:** February 13, 2026
**Platform:** Desktop Web (1920×1200 viewport), responsive to mobile
**Product:** Trading Caller — AI-Powered Solana Trading Signals

---

## 1. Executive Summary

This document is the single source of truth for Trading Caller's frontend design system, covering both the marketing landing page (`/`) and the trading dashboard pages (`/dashboard`, `/signals`, `/market`, `/volume`, `/leaderboard`, `/backtest`). It captures design tokens, component patterns, layout architecture, interaction behaviors, and accessibility requirements.

---

## 2. Design Philosophy

Trading Caller's design follows a **data-forward, trust-through-transparency** philosophy. The visual language prioritizes legibility, information density where it matters, and breathing room everywhere else. Think Bloomberg terminal meets modern SaaS — clean, trustworthy, precise.

**Core Pillars:**

- **Data is the hero** — real numbers, live stats, no filler content
- **Light & legible** — white backgrounds, high contrast, no eye strain
- **Typography carries the weight** — Inter for UI, JetBrains Mono for prices/data
- **Prove don't promise** — show actual win rates, PnL, signal accuracy from the API

---

## 3. Tech Stack

| Category | Stack |
|----------|-------|
| Framework | Next.js 15, React 19 |
| Styling | Tailwind CSS 4 (with @theme) |
| Components | shadcn/ui-style (custom) |
| Icons | lucide-react |
| State | React hooks (useState, useCallback, useEffect) |
| Type Safety | TypeScript 5.7 strict mode |
| Fonts | Inter (sans), JetBrains Mono (mono) |

---

## 4. Design Tokens

### 4.1 Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--color-bg-primary` | `#FFFFFF` | Page background |
| `--color-bg-secondary` | `#F8F9FA` | Card backgrounds, alternating table rows, sections |
| `--color-bg-elevated` | `#F0F1F3` | Hover states, active items |
| `--color-primary` | `#111827` | Headings, primary text |
| `--color-text-secondary` | `#6B7280` | Descriptions, labels, body copy |
| `--color-text-muted` | `#9CA3AF` | Timestamps, metadata, captions |
| `--color-accent` | `#7B61FF` | Primary brand purple — CTAs, active states, brand elements |
| `--color-accent-light` | `#9B85FF` | Hover states, lighter accent usage |
| `--color-cyan` | `#00D9FF` | Secondary accent, links, highlights |
| `--color-long` | `#16A34A` | Bullish signals, profit, success, positive metrics |
| `--color-short` | `#DC2626` | Bearish signals, loss, danger, negative metrics |
| `--color-warning` | `#F59E0B` | Medium confidence, caution states |
| `--color-border` | `#E5E7EB` | Card borders, table dividers |
| `--color-border-subtle` | `#F3F4F6` | Subtle internal separators |

### 4.2 Typography

| Element | Font Family | Weight | Size | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| H1 (Hero) | Inter | Bold (700) | 48–56px | 1.1 | -0.02em |
| H2 (Section) | Inter | Bold (700) | 36–40px | 1.2 | -0.01em |
| H3 (Card Title) | Inter | Semibold (600) | 20–24px | 1.3 | 0 |
| Body Large | Inter | Regular (400) | 18px | 1.6 | 0 |
| Body | Inter | Regular (400) | 16px | 1.6 | 0 |
| Body Small | Inter | Regular (400) | 14px | 1.5 | 0 |
| Caption | Inter | Medium (500) | 12px | 1.4 | 0.02em |
| Stat Number | Inter | Bold (700) | 32–48px | 1.1 | -0.02em |
| Data/Prices | JetBrains Mono | Medium (500) | 14–16px | 1.4 | 0 |
| Nav Link | Inter | Medium (500) | 15px | 1.0 | 0 |
| Button | Inter | Semibold (600) | 15px | 1.0 | 0 |

### 4.3 Spacing Scale

| Token | Value | Usage |
|---|---|---|
| `--space-1` | 4px | Minimal gap, icon padding |
| `--space-2` | 8px | Inline element spacing |
| `--space-3` | 12px | Tight component padding |
| `--space-4` | 16px | Standard component padding |
| `--space-5` | 24px | Card internal padding |
| `--space-6` | 32px | Grid gutters |
| `--space-7` | 48px | Between related sections |
| `--space-8` | 64px | Section internal padding |
| `--space-9` | 80px | Between major sections |
| `--space-10` | 120px | Hero/major section dividers |

### 4.4 Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 4px | Small tags, badges |
| `--radius-md` | 8px | Buttons, inputs |
| `--radius-lg` | 12px | Cards, FAQ items, feature cards |
| `--radius-xl` | 16px | Large containers |
| `--radius-full` | 9999px | Pills, avatar circles, status dots |

### 4.5 Shadows & Elevation

| Token | Value | Usage |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle card elevation |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` | Hover states, elevated cards |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.12)` | Modal overlays, floating nav |

---

## 5. Layout Architecture

### 5.1 Grid System

| Property | Value |
|---|---|
| Max content width | 1200px |
| Columns | 12-column grid (implied) |
| Gutter | 24–32px |
| Side margins | Auto-centered |
| Vertical rhythm | Sections separated by 80–120px (landing), 48–64px (dashboard) |

### 5.2 Page Map

| Route | Type | Purpose |
|---|---|---|
| `/` | Landing page | Marketing, value proposition, live stats, CTAs |
| `/dashboard` | Dashboard | Performance metrics, outcome breakdown, long vs short |
| `/signals` | Dashboard | Live trading signals with filters and auto-refresh |
| `/market` | Dashboard | RSI scanner table across 100 tokens |
| `/volume` | Dashboard | Volume spike detection and top volume table |
| `/leaderboard` | Dashboard | Token performance ranking |
| `/backtest` | Dashboard | Strategy backtesting results |

---

## 6. Landing Page Specification (`/`)

### 6.1 Navigation Bar

| Property | Value |
|---|---|
| Height | 64px |
| Background | `#FFFFFF` with 1px bottom `--color-border` on scroll |
| Logo | Trading Caller icon + wordmark, left-aligned, ~32px height |
| Nav links | Signals, Dashboard, RSI Scanner, Volume — center-aligned, medium weight, 15px |
| CTA button | "Open App →", filled `--color-accent` background, `--radius-md`, 40px height |
| Behavior | Sticky on scroll, background transitions from transparent to white with border |

### 6.2 Hero Section

| Property | Value |
|---|---|
| Layout | Centered text block, max-width ~720px |
| Badge | "AI-Powered" pill in `--color-accent` purple |
| Headline | "Trade Solana with real signals, not guesses." — H1, bold, 48–56px |
| Subheading | "AI-generated LONG and SHORT calls backed by real technical analysis. Every signal tracked, scored, and verified against actual outcomes." — 18px, `--color-text-secondary` |
| CTA Buttons | "View Live Signals →" (filled purple) + "Open Dashboard" (outlined) |
| Live stats | 3 inline counters below CTAs: **Total Signals**, **Win Rate**, **Avg PnL** — bold numbers with labels, fetched from `/api/signals/performance` |
| Vertical padding | ~120px top, ~80px bottom |

### 6.3 Feature Showcase

| Property | Value |
|---|---|
| Heading | "Built for traders who want an edge." — H2 |
| Layout | 2×2 card grid, 32px gap |
| Card style | `--color-bg-secondary` background, 1px `--color-border`, `--radius-lg`, 24–32px padding |
| Card content | Lucide icon (40px), H3 title (semibold, 20px), 1-2 sentence description (14–16px, `--color-text-secondary`) |

**Cards:**

| Card | Icon | Title | Description |
|---|---|---|---|
| 1 | `Radio` | Real-Time Signals | LONG and SHORT calls with entry, targets, and stop-loss levels. Updated hourly. |
| 2 | `Activity` | RSI Scanner | Scans top 100 Solana tokens for oversold and overbought conditions across 4 timeframes. |
| 3 | `BarChart3` | Volume Tracker | Detects volume spikes and anomalies before price moves. Severity-ranked alerts. |
| 4 | `FlaskConical` | Backtesting | Every strategy tested against historical data. Profit factor, drawdown, Sharpe ratio. |

### 6.4 How It Works

| Property | Value |
|---|---|
| Heading | "From scan to signal in seconds." — H2 |
| Layout | 3 items in a horizontal row, connected by subtle line/arrow |
| Item style | Large step number (1/2/3), H3 title, body description |

**Steps:**

| Step | Title | Description |
|---|---|---|
| 1 | Scan | Continuously monitors 100+ Solana tokens for technical setups. |
| 2 | Analyze | Calculates RSI, MACD, support/resistance, and volume confluence. |
| 3 | Signal | Generates actionable calls with entry, targets, and stop-loss levels. |

### 6.5 Performance Proof

| Property | Value |
|---|---|
| Heading | "Every call. Tracked. Scored. Transparent." — H2 |
| Layout | Full-width card, `--color-bg-secondary` background |
| Left side | Descriptive text: "No cherry-picked results. Every signal is scored against real market outcomes at 24h, 48h, and 7d intervals." |
| Right side | 2×2 metric grid: Win Rate, Total PnL, Profit Factor, Signals Tracked — live from API |
| Below | Mini outcome breakdown bar (TP1/TP2/TP3 hits vs stopped out) — teaser of dashboard |

### 6.6 FAQ Accordion

| Property | Value |
|---|---|
| Layout | Two-column: "FAQs" heading left (~30%), accordion right (~70%) |
| Heading | "FAQs" — H2, bold, 36px |
| Item background | `--color-bg-secondary` (`#F8F9FA`) |
| Item border-radius | `--radius-lg` (12px) |
| Item spacing | 8–12px gap |
| Item padding | 20–24px horizontal, 16–20px vertical |
| Question text | 16–18px, semibold, `--color-primary` |
| Answer text | 16px, regular, `--color-text-secondary`, 1.6 line-height |
| Toggle icon | "+" / "−", right-aligned, `--color-accent` |
| Animation | 300ms ease-in-out height transition |
| Items shown | 4 initially, "See More →" link below |

**FAQ Items:**

| Question | Answer |
|---|---|
| What is Trading Caller? | Trading Caller is an AI-powered trading companion for Solana. It generates LONG and SHORT signals using real technical analysis — RSI, MACD, support/resistance, and volume data — then tracks every call against actual market outcomes. |
| How are signals generated? | Signals are generated by fetching real OHLCV data, calculating 14-period RSI, identifying support/resistance levels, checking MACD and momentum, and scoring confidence based on indicator confluence. No guessing, no vibes. |
| How is performance tracked? | Every signal is tracked at 24h, 48h, and 7d intervals against real price data. We calculate win rate, PnL, profit factor, and outcome distribution (TP1/TP2/TP3 hits, stopped out, expired). All visible on the dashboard. |
| Is this financial advice? | No. Trading Caller provides AI-generated technical analysis signals for educational and informational purposes. Always do your own research and never trade more than you can afford to lose. |

### 6.7 Bottom CTA

| Property | Value |
|---|---|
| Background | `--color-bg-secondary` |
| Heading | "Ready to trade smarter?" — H2, centered |
| CTAs | "Browse Live Signals →" (filled) + "RSI Scanner" (outlined) |
| Padding | 80px vertical |

### 6.8 Footer

| Property | Value |
|---|---|
| Background | `#FFFFFF` |
| Layout | Logo left, link columns (Product, Resources, Legal), bottom one-liner |
| Link style | 14px, `--color-text-secondary`, underline on hover |

---

## 7. Dashboard Pages Specification

### 7.1 Shared Dashboard Layout

All dashboard pages share:

- **Same navigation bar** as landing page, active page gets filled purple pill background
- **Page header pattern:** H1 + subtitle + optional live badge / refresh button, left-aligned
- **Background:** `#FFFFFF`
- **Cards:** `--color-bg-secondary` background, 1px `--color-border`, `--radius-lg` (12px)
- **Footer:** Same as landing page

### 7.2 `/dashboard` — Performance Dashboard

| Section | Layout | Details |
|---|---|---|
| Top metrics | 4-card row | Win Rate, Total PnL, Profit Factor, Total Signals. White cards with colored left border (green positive, red negative, purple neutral). |
| Outcome Breakdown | Full-width card | Horizontal bar chart. Green for TP hits, red for stopped out, gray for expired, purple for active. Light background for clear contrast. |
| Long vs Short | 2-card row | Green header stripe for LONG, red for SHORT. 2×2 internal metric grid (Win Rate, Avg PnL, Wins, Losses). |
| Position Summary | 4-card row | Open Positions, Closed Positions, Position Win Rate, Position PnL. |
| Best/Worst Trade | 2-card row | Green left border (best), red left border (worst). Token name + PnL percentage. |

### 7.3 `/signals` — Live Signals

| Property | Value |
|---|---|
| Header | "Live Signals" + green pulsing dot + count. Filter pills: ALL / LONG / SHORT. Refresh button. |
| Layout | 2-column card grid (desktop), 1-column (mobile) |
| Signal card | White background, 1px border. Token name + action badge (green LONG / red SHORT) + timeframe badge. Confidence progress bar. Price levels grid (Entry, Stop, TP1/TP2/TP3) with `--color-bg-secondary` cells. RSI + risk badge. Truncated reasoning. Timestamp. |
| Auto-refresh | Polls `/api/signals/latest` every 30 seconds |

### 7.4 `/market` — RSI Scanner

| Property | Value |
|---|---|
| Summary stats | 3 cards: Tokens Scanned, Oversold (green accent), Overbought (red accent) |
| Controls | Search input + sort toggle + "Scan Now" button with progress bar |
| Table | White background, alternating row striping (`#FFFFFF` / `--color-bg-secondary`). 9 columns: Token, RSI 4h, RSI 1h/1d/1w, Price, 24h Change, Signal, Updated. RSI values in colored pill badges (green ≤30, red ≥70, gray neutral). |
| Mobile | Card grid with token+RSI top row, timeframe breakdown, price+signal bottom row |

### 7.5 `/volume` — Volume Scanner

| Property | Value |
|---|---|
| Summary stats | 3 cards: Tokens Tracked, Active Spikes, High/Extreme count |
| Volume Spikes | Card grid (3-col XL, 2-col MD, 1-col SM). Each card: severity-colored top border (yellow MEDIUM, red HIGH, pulsing red EXTREME). Token info, volume multiplier, buy/sell ratio, price changes, DexScreener link. |
| Top Volume table | Alternating row striping. 4 columns: Token, 1h Vol, 24h Vol, 1h Price Change. |

### 7.6 `/leaderboard` — Token Leaderboard

| Property | Value |
|---|---|
| Table | 6 columns: Rank, Token, Total Signals, Win Rate, Avg PnL, Total PnL. Top 3 get gold/silver/bronze left border + medal icon. Hover: `--color-bg-elevated`. |
| Mobile | Card grid with rank icon, token, 2×2 stats grid |
| Colors | Win rate: green ≥60%, red <40%. PnL: green >0, red <0. |

### 7.7 `/backtest` — Backtesting

| Property | Value |
|---|---|
| Strategy Comparison | 3-column card grid. Win rate progress bar, 3-metric grid (Avg PnL, Trades, Profit Factor). Best strategy: purple border + trophy + "Best" badge. |
| Results table | 8 columns: Strategy, Symbol, Trades, Win Rate, Total PnL, Profit Factor, Max Drawdown, Sharpe Ratio. Alternating rows. Color-coded metrics. |
| Mobile | Card grid with icon, symbol, badges, 2×2 metrics |

---

## 8. Interaction Design

### 8.1 Hover States

| Element | Hover Effect |
|---|---|
| Nav links | Color shift to `--color-accent` purple, subtle underline |
| CTA buttons | Background darkens 10%, `--shadow-md` appears |
| Feature cards | `--shadow-md` + `translateY(-2px)` lift |
| Signal cards | Border color shifts to `--color-accent` |
| Table rows | Background shifts to `--color-bg-elevated` (`#F0F1F3`) |
| FAQ items | Subtle background darkening, cursor: pointer |
| Links / "See More" | Underline appears, arrow shifts right 4px |

### 8.2 Transition Timing

| Property | Duration | Easing |
|---|---|---|
| Color changes | 150ms | ease-out |
| Shadow/elevation | 200ms | ease-out |
| Accordion expand | 300ms | ease-in-out |
| Tab content swap | 200ms | ease-in-out |
| Scroll reveal (landing only) | 400ms | ease-out |
| Nav background on scroll | 200ms | ease-out |

### 8.3 Scroll Behavior

- **Landing page:** Sticky nav with transparent → white + border on scroll. Sections fade up on viewport entry (400ms ease-out). Smooth anchor scrolling.
- **Dashboard pages:** No scroll animations. Data renders instantly. Sticky nav only.

### 8.4 Loading States

- **Skeleton loaders:** All dashboard pages. `--color-bg-elevated` (`#F0F1F3`) pulse animation.
- **Live stat counters (landing):** Skeleton → number with brief count-up on first load.
- **Refresh button:** Spinning icon during fetch.
- **RSI scan:** Progress bar (batch X of Y, X%).

### 8.5 Error States

- Graceful fallback card with retry button
- `--color-bg-secondary` card with `--color-short` (red) left border accent
- "Something went wrong" message + retry CTA

---

## 9. Accessibility

### 9.1 Color Contrast

| Combination | Ratio | WCAG Level |
|---|---|---|
| `--color-primary` (#111827) on `--color-bg-primary` (#FFFFFF) | 15.4:1 | AAA |
| `--color-text-secondary` (#6B7280) on `--color-bg-primary` (#FFFFFF) | 4.6:1 | AA |
| `--color-accent` (#7B61FF) on `--color-bg-primary` (#FFFFFF) | 4.5:1 | AA |
| `--color-long` (#16A34A) on `--color-bg-primary` (#FFFFFF) | 4.5:1 | AA |

### 9.2 Keyboard Navigation

- All interactive elements reachable via Tab
- Visible focus indicators: 2px `--color-accent` purple outline
- FAQ accordion toggles with Enter/Space
- Skip-to-content link as first focusable element
- Tab navigation between filter pills on signals page

### 9.3 Semantic Structure

```
<header>         — Navigation (shared)
<main>
  <section>      — Page content (varies per route)
</main>
<footer>         — Footer (shared)
```

### 9.4 ARIA Patterns

- FAQ accordion: `aria-expanded`, `aria-controls`, `role="region"`
- Navigation: `role="navigation"`, `aria-label="Main"`, `aria-current="page"` on active link
- Live stats: `aria-label` for screen reader context on numerical values
- Signal filter pills: `role="radiogroup"` with `role="radio"` and `aria-checked`
- Tables: Proper `<thead>`, `<tbody>`, `<th scope="col">` structure

### 9.5 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 10. Responsive Breakpoints

| Breakpoint | Width | Adaptations |
|---|---|---|
| Desktop XL | ≥1440px | Full layout, 12-col grid |
| Desktop | 1024–1439px | Content max-width maintained, margins shrink |
| Tablet | 768–1023px | Feature grid 2→1 col, signal cards 1 col, tables → card view |
| Mobile | <768px | Hamburger nav, single column everything, 48px touch targets |

### Mobile-Specific Considerations

- Hamburger menu with full-screen overlay
- Minimum 48×48px touch targets
- Tables convert to card grids (already implemented in current codebase)
- Bottom sticky CTA bar consideration for key actions

---

## 11. Performance Targets

| Metric | Target | Strategy |
|---|---|---|
| LCP | < 2.5s | Hero text renders first, stats lazy-loaded from API |
| CLS | < 0.1 | Reserve space for cards/stats with skeleton loaders |
| FID | < 100ms | Minimal JS on initial load, accordion interaction deferred |
| Font loading | `font-display: swap` | System font fallback prevents FOIT |
| Images | SVG icons only | No raster images needed — lucide icons + typography-driven design |

---

## 12. Visual Migration Summary

Key changes from the current dark theme to the new light theme:

| Element | Current (Dark) | Revamped (Light) |
|---|---|---|
| Page background | `#0E0E10` | `#FFFFFF` |
| Card background | `#1A1A1F` | `#F8F9FA` with 1px `#E5E7EB` border |
| Primary text | `#F0F0F5` | `#111827` |
| Secondary text | `#9898A6` | `#6B7280` |
| Borders | `#2A2A35` (barely visible) | `#E5E7EB` (clear definition) |
| Data tables | Dark rows, low contrast | Alternating white/gray rows, high contrast |
| Skeleton loaders | `#252530` pulse | `#F0F1F3` pulse |
| Brand accent | `#7B61FF` (kept) | `#7B61FF` (kept) |
| Long/profit | `#00E676` | `#16A34A` (slightly muted for light bg) |
| Short/loss | `#FF5252` | `#DC2626` (slightly muted for light bg) |

---

## 13. Implementation Checklist

- [ ] Update `globals.css` with new light theme tokens
- [ ] Update all component backgrounds and text colors
- [ ] Build landing page sections (Hero, Features, How It Works, Performance, FAQ, CTA)
- [ ] Convert navigation to shared layout with transparent→white scroll behavior
- [ ] Add alternating row striping to all data tables
- [ ] Add colored left-border accents to metric cards
- [ ] Update skeleton loaders to light palette
- [ ] Update badge colors for light background contrast
- [ ] Test all pages at all breakpoints
- [ ] Verify color contrast meets AA minimum (AAA for body text)
- [ ] Implement `prefers-reduced-motion` media query
- [ ] Add FAQ accordion with proper ARIA
- [ ] Lighthouse targets: Performance ≥90, Accessibility ≥95, Best Practices ≥90

---

*This document is the source of truth for the Trading Caller frontend. Updated February 13, 2026.*