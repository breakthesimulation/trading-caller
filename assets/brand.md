# Trading Caller - Brand Guidelines

## Brand Identity

**Trading Caller** is an AI-powered trading signals platform for Solana. The brand is friendly, approachable, and premium — inspired by Phantom's clean, light aesthetic.

### Tagline
*"Free your mind — AI trading calls for Solana"*

### Voice & Tone
- Friendly and approachable
- Confident but not arrogant
- Clear and direct
- Professional but not stuffy

## Visual Identity

### Design Philosophy

**Light, not dark.** Unlike typical crypto dashboards, Trading Caller uses a bright, clean interface that feels modern and trustworthy.

**Mixed card backgrounds.** Following Phantom's approach, we use a variety of card colors (purple, dark, cream) to create visual interest and hierarchy.

**Generous whitespace.** Let the design breathe. Dense information presented cleanly.

**Soft, rounded corners.** 20px+ border radius on major elements. Friendly, not harsh.

### Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Background | `#FAFAFA` | Page background |
| Surface | `#FFFFFF` | Cards, inputs |
| Primary Purple | `#AB9FF2` | Buttons, highlights |
| Card Purple | `#E9E3FF` | Light purple cards |
| Accent Purple | `#7B61FF` | Icons, links |
| Card Dark | `#1A1A1A` | Dark contrast cards |
| Card Cream | `#F5F0E8` | Warm beige cards |
| Text Primary | `#1A1A1A` | Headlines, body |
| Text Secondary | `#6B6B6B` | Labels, captions |
| Success | `#22C55E` | Buy signals (opportunity) |
| Danger | `#EF4444` | Sell signals (warning) |

### Color Psychology
- **Light Purple (#E9E3FF)**: Friendly, premium, crypto-native
- **Dark Cards (#1A1A1A)**: Contrast, emphasis, variety
- **Cream (#F5F0E8)**: Warmth, approachability
- **Green (#22C55E)**: Opportunity, go signal, bullish
- **Red (#EF4444)**: Caution, warning, bearish

### Typography

**Primary Font:** Inter

The most important aspects:
- Clean, modern, highly readable
- Excellent for data interfaces
- Variable weight support

**Font Weights:**
- Regular (400): Body text
- Medium (500): Labels, navigation
- Semibold (600): Table headers, emphasis
- Bold (700): Headlines
- ExtraBold (800): Display headings

**No gradient text.** Headlines and text use solid colors only.

### Spacing

8px base grid:
- `xs`: 4px (0.25rem)
- `sm`: 8px (0.5rem)
- `md`: 16px (1rem)
- `lg`: 24px (1.5rem)
- `xl`: 32px (2rem)
- `2xl`: 48px (3rem)
- `3xl`: 64px (4rem)

### Border Radius

Generously rounded, following Phantom's approach:
- Small: 8px
- Medium: 12px
- Large: 20px (default for cards)
- XL: 28px
- Full: 9999px (pills, buttons)

### Shadows

Soft, diffused shadows — never harsh:
```css
/* Subtle card shadow */
box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);

/* Elevated on hover */
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);

/* Purple glow for CTAs */
box-shadow: 0 4px 20px rgba(171, 159, 242, 0.25);
```

## Logo

The logo features trading signal elements (upward arrow/chart) in a rounded square:
- Icon background: Light purple (#E9E3FF)
- Signal icon: Accent purple (#7B61FF)
- Accent elements: Success green
- Minimum size: 32x32px
- Border radius on icon: 30% of size

### Logo Usage
- On light backgrounds: Full color
- On dark backgrounds: Purple icon with white text
- On purple backgrounds: White icon with dark text

## UI Components

### Buttons

**Primary**: Solid purple (#AB9FF2), dark text, soft shadow
**Success**: Light green background, green text
**Danger**: Light red background, red text  
**Outline**: Transparent, border only
**Ghost**: Very light background, subtle

All buttons use 14px border radius.

### Cards

Mix these for visual variety:
- **White cards**: Default, with subtle shadow
- **Purple cards**: #E9E3FF for featured content
- **Dark cards**: #1A1A1A for contrast (white text)
- **Cream cards**: #F5F0E8 for warmth

All cards use 20px+ border radius.

### Signal Cards

Trading signals use color coding:
- **Buy signals**: Green border/accent (#22C55E)
- **Sell signals**: Red border/accent (#EF4444)
- **Neutral/Watch**: Yellow border/accent (#F59E0B)

### Tables

- White background
- Subtle row dividers (#E5E5E5)
- Hover state: Light lavender (#F4F1FF)
- Color-coded values (green positive, red negative)

## Animation Guidelines

- Smooth easing (`ease` or `cubic-bezier(0.34, 1.56, 0.64, 1)`)
- Duration: 150-300ms for interactions
- Subtle transforms on hover (translateY, scale)
- No excessive motion

## Do's and Don'ts

### Do
✅ Use light backgrounds as the default
✅ Mix card colors (purple, dark, cream) for variety
✅ Use generous whitespace
✅ Keep text solid colors (no gradients)
✅ Use soft shadows
✅ Round corners generously (20px+)

### Don't
❌ Default to dark mode
❌ Use gradient text
❌ Use harsh borders instead of shadows
❌ Make all cards the same color
❌ Use small border radius
❌ Overcrowd the interface
