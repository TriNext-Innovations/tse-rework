# Design Tokens

**Issue:** #7.2  
**Status:** Complete — colours are placeholder values pending client confirmation (issue #3.2)

---

## Single source of truth

All colours live in one place: the **Brand Tokens block** at the top of
`apps/web/src/app/globals.css`. To rebrand, edit only that block — nothing
else in the codebase needs changing.

---

## Brand tokens

Defined as CSS custom properties in HSL triplet format (`H S% L%` — no
`hsl()` wrapper). This format is required for Tailwind opacity modifiers
(`bg-brand-primary/50`) to work correctly.

| Token | Light value | Dark value | Purpose |
|---|---|---|---|
| `--brand-primary` | `173 85% 32%` (#0D9488) | `175 79% 48%` | CTA buttons, links, active states |
| `--brand-primary-foreground` | `0 0% 100%` | `222 47% 11%` | Text on primary backgrounds |
| `--brand-secondary` | `222 47% 11%` (#111827) | *(unchanged)* | Dark charcoal — nav, headings |
| `--brand-secondary-foreground` | `0 0% 100%` | *(unchanged)* | Text on secondary backgrounds |
| `--brand-accent` | `175 79% 40%` (#14B8A6) | `175 79% 55%` | Hover states, highlights |
| `--brand-accent-foreground` | `222 47% 11%` | `222 47% 11%` | Text on accent backgrounds |
| `--brand-bg` | `0 0% 100%` | `222 47% 7%` | Page background |
| `--brand-surface` | `210 40% 98%` | `222 47% 11%` | Card / panel background |
| `--brand-border` | `220 13% 91%` | `220 13% 18%` | Borders and dividers |
| `--brand-text` | `220 13% 26%` (#374151) | `210 40% 96%` | Body text |
| `--brand-text-muted` | `220 9% 46%` (#6B7280) | `220 9% 60%` | Secondary / placeholder text |
| `--brand-destructive` | `0 84% 60%` | `0 63% 55%` | Errors, delete actions |
| `--brand-destructive-foreground` | `0 0% 100%` | *(unchanged)* | Text on destructive backgrounds |

> **All values are placeholders** extracted from the existing WooCommerce site.
> Update once TSE confirms brand colours in issue #3.2.

---

## Tailwind utilities

Brand tokens are exposed as Tailwind colour utilities in `packages/config/tailwind.config.ts`.
Every utility supports opacity modifiers.

```
bg-brand-primary          text-brand-primary          border-brand-primary
bg-brand-primary/50       text-brand-primary/75       ...

bg-brand-secondary        text-brand-secondary
bg-brand-accent           text-brand-accent
bg-brand-bg               text-brand-bg
bg-brand-surface          text-brand-surface
bg-brand-border           text-brand-border
bg-brand-text             text-brand-text
bg-brand-text-muted       text-brand-text-muted
bg-brand-destructive      text-brand-destructive
```

---

## shadcn semantic token mapping

shadcn components use `--background`, `--primary`, `--border`, etc. These are
mapped onto brand tokens in the **shadcn Variable Mapping block** in `globals.css`.
Never set colour values in the mapping block — change them in Brand Tokens.

| shadcn token | Maps to |
|---|---|
| `--background` | `--brand-bg` |
| `--foreground` | `--brand-text` |
| `--primary` | `--brand-primary` |
| `--primary-foreground` | `--brand-primary-foreground` |
| `--secondary` | `--brand-surface` |
| `--secondary-foreground` | `--brand-secondary` |
| `--accent` | `--brand-accent` |
| `--accent-foreground` | `--brand-accent-foreground` |
| `--muted` | `--brand-surface` |
| `--muted-foreground` | `--brand-text-muted` |
| `--card` | `--brand-bg` |
| `--border` | `--brand-border` |
| `--input` | `--brand-border` |
| `--ring` | `--brand-primary` |
| `--destructive` | `--brand-destructive` |

---

## Typography tokens

Fonts are loaded via `next/font/google` in `apps/web/src/app/layout.tsx` and
injected as CSS variables on `<html>`.

| Token | Font | Use |
|---|---|---|
| `--font-sans` / `font-sans` | Inter | Body, UI, labels |
| `--font-display` / `font-display` | Fraunces | Headings, hero text |

Fraunces is loaded in weights 300 / 400 / 500 / 700, normal + italic.

---

## How to rebrand

1. Open `apps/web/src/app/globals.css`
2. Edit the HSL values in the `/* ─── BRAND TOKENS ─── */` block
3. Update this doc's table above to match
4. Done — all components, shadcn UI, and Tailwind utilities update automatically
