# Brand Update Design

**Date:** 2026-02-13
**Goal:** Update the website to match the Agent Fox brand specification.

## Decisions

- **Theme:** Stay light
- **Primary accent:** Orange `#FF5722`
- **Typography:** Inter Bold (headings) + Nunito Regular (body)
- **Logos:** Placeholders only (user will provide real assets later)

## Color Mapping

| Current | New | Usage |
|---------|-----|-------|
| `#7B61FF` accent | `#FF5722` (Orange) | Primary accent - buttons, links, CTAs, focus rings |
| `#9B85FF` accent-light | `#FF8A65` (lighter orange) | Hover states, light accent backgrounds |
| `#00D9FF` cyan | `#7E73F2` (Purple) | Secondary accent - badges, highlights |
| `#16A34A` long/green | `#009F85` (Brand Green) | Bullish/long signals |
| `#DC2626` short/red | `#DC2626` (keep) | Bearish/short signals |
| `#F59E0B` warning | `#F59E0B` (keep) | Warnings |

### Secondary palette (backgrounds/accents)

- Lavender `#D6D3FF` - subtle purple backgrounds
- Cream `#FFCC99` - warm accent backgrounds
- Light Teal `#80E4E0` - info/neutral highlights
- Mint `#B3DDFE` - light blue accents

## Typography

- **Headings:** Inter Bold (700)
- **Body:** Nunito Regular (400) + Medium (500) - add via Google Fonts
- **Monospace:** JetBrains Mono (keep)

## Logo Placeholders

- **Nav:** 32x32 placeholder with "AF" monogram
- **Footer:** Larger placeholder with "AGENT FOX" wordmark
- **Landing hero:** Largest placeholder for mascot logo
- All use `<div>` with brand orange styling, easily replaceable with `<Image>`

## Files to Change

1. `globals.css` - CSS custom properties
2. `layout.tsx` - Add Nunito font
3. `nav.tsx` - Logo placeholder, brand name
4. `footer.tsx` - Wordmark placeholder, brand name
5. `page.tsx` (landing) - Mascot placeholder in hero
6. `badge.tsx` - Update cyan variant to purple
7. `utils.ts` - RSI colors to brand green

## What stays the same

- Layout, page structure, responsive behavior
- Component architecture (CVA patterns)
- Data fetching, API integration
- Semantic HTML and accessibility
