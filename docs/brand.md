# TSE Online — Brand Guidelines

> Created by TriNext Innovations · 2026-05-15
> This document replaces any informal brand conventions previously in use.
> Update it whenever a brand decision is formally confirmed.

---

## 1. Brand Story

**Technical Systems Engineering (TSE)** has been South Africa's printer-cartridge specialist since 1992, operating out of Unit 34, A.P.D. Industrial Park, Kya Sands, Johannesburg.

TSE sells **only quality generic/compatible cartridges** — never OEM originals. The entire value proposition is delivering the same print quality as the original at a fraction of the price, backed by a no-fuss replacement guarantee.

The logo's halftone dot gradient tells this story visually: the four colours — lime, cyan, pink, and black — are the four CMYK printing inks. TSE is, literally, a colour company.

---

## 2. Logo

### Primary Logo
- File: `apps/web/public/brand/logo.png` (3 MB, transparent background)
- Aspect ratio: 2:1 (width:height)
- A TSE "tse" wordmark with a CMYK halftone dot gradient flowing yellow-lime → cyan → pink → black
- **Current SVG is a raster trace (1.3 MB) — not true vector.** Request original Illustrator/CorelDraw source from client when possible.

### Usage Variants

| Variant | When to use | Implementation |
|---------|-------------|----------------|
| `color` | Light backgrounds, white surfaces | PNG as-is |
| `dark-bg` | Dark or coloured backgrounds | White pill wrapper (`bg-white rounded-lg px-2 py-1`) |
| `mono-white` | Dark solid fills where pill looks heavy | CSS filter `brightness(0) invert(1)` |
| `mono-dark` | Light backgrounds needing a single-colour mark | CSS filter `brightness(0)` |

All variants are handled by the `<Logo>` component at `apps/web/src/components/layout/Logo.tsx`.

### Logo Rules
- Minimum width: 80px
- Always maintain the 2:1 aspect ratio — never stretch
- Do not recolour the logo manually; use the four approved variants above
- Do not place the colour logo directly on dark backgrounds without the white pill wrapper
- Do not add drop shadows to the logo itself
- Clear space: minimum half the logo height on all sides

---

## 3. Colour Palette

All values are confirmed by the client (issue #23, 2026-05-15).

### Core Palette

| Name | Hex | HSL | Role |
|------|-----|-----|------|
| **Lime** (Primary) | `#dfe344` | `62 74% 58%` | Primary CTAs, key highlights, active states |
| **Cyan** (Secondary) | `#41e0f5` | `187 90% 61%` | Secondary accents, links, interactive elements |
| **Pink** (Accent) | `#ee75e9` | `303 78% 70%` | Glows, ambient light effects, decorative accents |
| **Black** (Dark) | `#111827` | `221 39% 11%` | Footer, dark surfaces, body text, letterforms |

### Extended Palette

| Name | Hex | Role |
|------|-----|------|
| Page background | `#FFFFFF` | Default light surface |
| Surface / card | `#F7F7F4` | Slightly off-white, faint lime tint |
| Border | `#EBEBEA` | Dividers, input outlines |
| Body text | `#374151` | Primary readable text |
| Muted text | `#6B7280` | Labels, captions, placeholders |

### Colour Usage Rules
- **Lime** is high-energy — use it for primary action buttons and key stat highlights. It is too light for body text on white backgrounds (contrast ratio < 4.5:1); always pair with dark text (`#111827`) when used as a background.
- **Cyan** works well for interactive links, hover states, and secondary buttons.
- **Pink** is a soft accent — ideal for glows, ambient blur effects, and decorative elements. Avoid using it as a large solid background on light pages.
- **Black** (`#111827`) is the default for all body text, navigation, and dark-surface fills.
- Never use lime or cyan as text colour on white backgrounds — contrast fails WCAG AA for normal-sized text.

### CSS Tokens
Defined in `apps/web/src/app/globals.css` — single source of truth. Never hardcode hex values in components; use Tailwind utilities (`bg-brand-primary`, `text-brand-cmyk-cyan`) or CSS variables (`var(--brand-primary)`).

---

## 4. Typography

> **Status:** Pending written client confirmation (issue #24). Current implementation uses the proposed pairing below.

### Type Scale

| Role | Font | Weight | Usage |
|------|------|--------|-------|
| Display / Headings | **Fraunces** | 300–700, italic available | Hero headings, section titles, large pull quotes |
| Body / UI | **Inter** | 400–600 | Navigation, product names, prices, descriptions, buttons, labels |

Both loaded via `next/font/google` in `apps/web/src/app/layout.tsx`. CSS variables: `--font-display` (Fraunces), `--font-sans` (Inter).

### Typography Rules
- Heading size scale: `9.5vw` hero → `6xl` → `5xl` → `4xl` → `3xl` → `2xl`
- Body text minimum: `15px` / `text-sm` (`0.875rem`) — never smaller on mobile
- Line height: `1.5–1.75` for body copy (`leading-relaxed`)
- Line length: target 65–75 characters per line (`max-w-xl` or `max-w-2xl`)
- Use Fraunces italic (`font-display-italic`) sparingly for editorial emphasis — not for UI labels
- Letter spacing: `tracking-tight` on large display text, `tracking-widest` on small uppercase labels

---

## 5. Brand Voice

### Tone
- **Direct and confident** — no filler words, no corporate hedging
- **Honest** — the product is generic, not OEM; own it and make it the selling point
- **Practical** — South African offices and print shops care about price, reliability, and speed

### Core Messages (use these verbatim where possible)
- *"Generic. Not generic."* — the hero headline that captures the paradox
- *"Works as good, or even better than the original."* — the guarantee line; this is the client's own wording
- *"Order before noon, on your desk tomorrow."* — delivery promise (JHB/PTA)
- *"South Africa's printer-cartridge specialist since 1992."* — trust anchor

### Words to Use
`Compatible` · `Generic` · `Quality generic` · `Specialist` · `Guaranteed` · `Engineered` · `Reliable`

### Words to Avoid
`OEM` · `Genuine` · `Authentic` · `Original` (when describing TSE products) · `Cheap` (implies low quality — say "fraction of the price" or "cost-effective" instead)

### Founding Year
Always **1992** — not 1987.

---

## 6. Imagery & Photography

- **Current source:** WooCommerce media library export — sufficient for relaunch
- **Style:** Clean product shots on white or near-white backgrounds preferred
- **Avoid:** Lifestyle shots that obscure the product; stock imagery of generic offices
- **Future:** Client to supply updated photography post-launch (issue #25)

### Product Card Treatment (current)
Placeholder cards use dark gradient fills with the TSE wordmark until real product images are available. Gradient palette: `#111827 → #374151` (dark), `#41e0f5 → #0fb8d4` (cyan), `#1a1a2e → #3a3a5c` (navy).

---

## 7. Iconography

- Use **SVG icons only** — no emoji as UI icons
- Preferred library: Lucide or Heroicons (consistent `24×24` viewBox, `strokeWidth="2"`)
- Minimum touch target: `44×44px` (wrap small icons in a button/link with padding)
- Icon colour: inherit from text colour via `currentColor` — never hardcode icon fill

---

## 8. Motion & Animation

| Element | Duration | Easing |
|---------|----------|--------|
| Micro-interactions (hover, focus) | `150–300ms` | `ease-out` |
| Page-level reveals | `900ms` | `cubic-bezier(.22,1,.36,1)` |
| Ambient / decorative (float, spin) | `7–22s` | `ease-in-out` / `linear` |

- Always include `prefers-reduced-motion` override — all decorative animations are disabled when the user has requested reduced motion
- Use `transform` and `opacity` for animated properties — never animate `width`, `height`, or `margin`

---

## 9. Layout & Spacing

- Max content width: `max-w-7xl` (80rem / 1280px) — consistent across all sections
- Page horizontal padding: `px-4 sm:px-8 lg:px-12`
- Section vertical padding: `py-16 sm:py-24` (standard) / `py-20 sm:py-28` (feature sections)
- Border radius: `rounded-[20px]` product cards · `rounded-[24px]` bento cards · `rounded-[28px]` CTA band · `rounded-full` pills and tags
- Z-index scale: `z-10` content layers · `z-20` overlays · `z-40` floating nav · `z-50` modals

---

## 10. Do / Don't Summary

| Do | Don't |
|----|-------|
| Call products "generic" or "compatible" | Call them "OEM", "genuine", or "authentic" |
| Use `#111827` for body text on white | Use lime or cyan as text colour on white |
| Use the white pill wrapper on dark backgrounds | Place the colour logo directly on dark fills |
| Dark text (`#111827`) on lime/pink button backgrounds | White text on lime or pink (contrast too low) |
| Reference founding year as 1992 | Use 1987 anywhere |
| SVG icons from Lucide / Heroicons | Emoji as UI icons |
| `transform`/`opacity` for animations | `width`/`height`/`margin` animations |
