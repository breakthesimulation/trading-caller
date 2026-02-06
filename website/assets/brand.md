# Trading Caller Brand Guidelines

A premium crypto trading signals platform with a modern, trustworthy aesthetic inspired by Phantom wallet.

---

## Logo

### Primary Logo
The Trading Caller logo consists of two elements:
1. **Icon Mark** - A central beacon/diamond shape with radiating signal waves
2. **Wordmark** - "Trading" in white, "Caller" in gradient purple

The diamond represents precision and value, while the signal waves communicate the core function of delivering trading calls.

### Usage
- **Minimum size**: 120px wide for full logo, 24px for icon only
- **Clear space**: Maintain padding equal to the height of the diamond icon on all sides
- **Dark backgrounds**: Use full-color version (default)
- **Light backgrounds**: Icon remains gradient; text becomes dark (#0E0E10)

### Don't
- Don't rotate or skew the logo
- Don't change the gradient colors
- Don't add effects like drop shadows
- Don't stretch or distort proportions

---

## Color Palette

### Primary - Purple/Violet
The signature color conveying premium quality and crypto-native aesthetics.

| Token | Hex | Usage |
|-------|-----|-------|
| Primary 100 | `#E8E4FF` | Light backgrounds |
| Primary 300 | `#AB9FF2` | Gradient start, highlights |
| **Primary 500** | `#7B61FF` | **Main brand color** |
| Primary 600 | `#5E4AE3` | Gradient end, hover states |
| Primary 800 | `#3A2E96` | Deep accents |

### Secondary - Teal/Cyan
Accent color for highlights, links, and secondary actions.

| Token | Hex | Usage |
|-------|-----|-------|
| Secondary 300 | `#66EEFF` | Highlights |
| **Secondary 500** | `#00D9FF` | **Main accent color** |
| Secondary 700 | `#008DA8` | Darker accents |

### Backgrounds

| Token | Hex | Usage |
|-------|-----|-------|
| BG Primary | `#0E0E10` | Main page background |
| BG Secondary | `#131316` | Sections, alternating areas |
| BG Surface | `#1A1A1F` | Cards, modals, inputs |
| BG Elevated | `#252530` | Hover states, elevated cards |

### Text

| Token | Value | Usage |
|-------|-------|-------|
| Text Primary | `#FFFFFF` | Headings, important text |
| Text Secondary | `rgba(255,255,255,0.72)` | Body text |
| Text Tertiary | `rgba(255,255,255,0.48)` | Labels, captions |
| Text Muted | `rgba(255,255,255,0.32)` | Placeholders, disabled |

### Semantic - Trading

| Token | Hex | Usage |
|-------|-----|-------|
| Success | `#00E676` | LONG signals, profit, buy |
| Danger | `#FF5252` | SHORT signals, loss, sell |
| Warning | `#FFB74D` | Caution, pending, alerts |
| Info | `#64B5F6` | Information, neutral updates |

---

## Typography

### Font Stack
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
```

For monospace (prices, data):
```css
font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
```

### Type Scale

| Name | Size | Weight | Usage |
|------|------|--------|-------|
| Display | 48px | 700 | Hero headlines |
| H1 | 36px | 700 | Page titles |
| H2 | 30px | 600 | Section headers |
| H3 | 24px | 600 | Card titles |
| H4 | 20px | 600 | Subsections |
| Body | 16px | 400 | Paragraphs |
| Small | 14px | 400 | Secondary text |
| Caption | 12px | 500 | Labels, badges |

### Letter Spacing
- Headlines: `-0.02em` (tight)
- Body: `0` (normal)
- Badges/Labels: `0.02em` (wide)

---

## Spacing System

Based on a 4px grid for consistent rhythm.

| Token | Size | Usage |
|-------|------|-------|
| space-1 | 4px | Tight gaps |
| space-2 | 8px | Icon gaps, small padding |
| space-3 | 12px | Input padding, badge padding |
| space-4 | 16px | Default padding |
| space-6 | 24px | Card padding |
| space-8 | 32px | Section gaps |
| space-12 | 48px | Large sections |
| space-16 | 64px | Page sections |

---

## Border Radius

| Token | Size | Usage |
|-------|------|-------|
| radius-sm | 6px | Badges, small elements |
| radius-md | 10px | Inputs, small buttons |
| radius-lg | 14px | Buttons, small cards |
| radius-xl | 20px | Cards, modals |
| radius-2xl | 28px | Large cards, hero elements |
| radius-full | 9999px | Pills, avatars |

---

## Gradients

### Primary Gradient
```css
linear-gradient(135deg, #AB9FF2 0%, #7B61FF 50%, #5E4AE3 100%)
```
Use for: Primary buttons, logo, key CTAs

### Accent Gradient
```css
linear-gradient(90deg, #00D9FF 0%, #7B61FF 100%)
```
Use for: Highlights, progress bars, decorative elements

### Success Gradient
```css
linear-gradient(135deg, #00E676 0%, #00C853 100%)
```
Use for: LONG signals, profit indicators

### Danger Gradient
```css
linear-gradient(135deg, #FF5252 0%, #E53935 100%)
```
Use for: SHORT signals, loss indicators

---

## Shadows & Effects

### Elevation
```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.6);
--shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.7);
```

### Glow Effects
```css
--shadow-glow-primary: 0 0 24px rgba(123, 97, 255, 0.4);
--shadow-glow-success: 0 0 24px rgba(0, 230, 118, 0.4);
--shadow-glow-danger: 0 0 24px rgba(255, 82, 82, 0.4);
```

---

## Components

### Buttons

**Primary** - Gradient purple with glow, for main CTAs
**Secondary** - Transparent with border, for secondary actions
**Ghost** - No background, for tertiary actions
**Success** - Green gradient, for LONG/Buy actions
**Danger** - Red gradient, for SHORT/Sell actions

### Signal Cards

Trading signal cards feature:
- Top accent bar (green for LONG, red for SHORT)
- Trading pair prominently displayed
- Direction badge (LONG/SHORT)
- Key metrics: Entry, Target, Stop Loss
- Timestamp and confidence score

### Input Fields

- Dark surface background
- Subtle border that glows purple on focus
- Placeholder text in muted color
- Consistent padding and border radius

---

## Animation

### Transitions
```css
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
```

### Hover Effects
- Buttons: Slight lift (`translateY(-1px)`) with enhanced glow
- Cards: Border color lightens
- Interactive elements: Smooth color transitions

---

## Voice & Tone

### Brand Personality
- **Confident** - We know trading
- **Clear** - No jargon, straightforward signals
- **Premium** - Quality over quantity
- **Trustworthy** - Transparency in performance

### Writing Style
- Use active voice
- Be concise and direct
- Numbers are precise (use monospace font)
- Avoid hype language ("guaranteed", "never lose")

---

## File Reference

| File | Purpose |
|------|---------|
| `logo.svg` | Full logo with wordmark |
| `icon.svg` | Square app icon/favicon |
| `brand.css` | CSS custom properties and components |
| `brand.md` | This document |

---

*Trading Caller - Premium Crypto Signals*
