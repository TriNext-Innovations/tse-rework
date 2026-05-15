# TSE Online — Docs

Reference documents for the TSE Online build. The root [README.md](../README.md) has setup instructions and the full Phase 0 todo list.

---

## Documents

| File | Purpose |
|---|---|
| [data-model.md](data-model.md) | PostgreSQL compatibility schema — printer_brand, printer_model, cartridge_compatibility. ERD, table DDL, query examples. |
| [design-tokens.md](design-tokens.md) | Brand colour tokens, Tailwind utilities, shadcn semantic mapping, typography. How to rebrand in one file. |
| [Architecture.md](Architecture.md) | System architecture, data flow, infrastructure decisions. |
| [DEVELOPER-GUIDE.md](DEVELOPER-GUIDE.md) | Local setup, git workflow, testing, migrations, go-live checklist. |
| [BUILD-PLAN.md](BUILD-PLAN.md) | Milestone breakdown and delivery timeline. |
| [RETAINER-SCOPE.md](RETAINER-SCOPE.md) | Monthly retainer services, SLAs, and handover terms. |

---

## Current specs (Phase 0)

### Apps

| Workspace | Package | Port | Entry |
|---|---|---|---|
| `apps/web` | `@tse/web` | 3000 | `src/app/layout.tsx` |
| `apps/backend` | `@tse/backend` | 9000 | Medusa v2 |
| `apps/studio` | `@tse/studio` | 3333 | `sanity.config.ts` |

### Shared packages

| Workspace | Package | Contents |
|---|---|---|
| `packages/config` | `@tse/config` | Tailwind config, ESLint config, TS base config |
| `packages/ui` | `@tse/ui` | Shared shadcn/ui component exports |
| `packages/types` | `@tse/types` | Shared TypeScript interfaces |

### Design system

| Token type | Source of truth | How to use |
|---|---|---|
| Brand colours | `apps/web/src/app/globals.css` — Brand Tokens block | `bg-brand-primary`, `text-brand-text`, etc. |
| shadcn colours | `globals.css` — shadcn Variable Mapping block | `bg-background`, `text-foreground`, etc. |
| Tailwind config | `packages/config/tailwind.config.ts` | `brand.*` utilities + shadcn tokens |
| Fonts | `apps/web/src/app/layout.tsx` | Inter → `font-sans`, Fraunces → `font-display` |

**To rebrand:** edit only the Brand Tokens block in `globals.css`. Nothing else needs changing.

### Colour tokens (placeholders — pending #3.2 client confirmation)

| Token | Light | Purpose |
|---|---|---|
| `--brand-primary` | `173 85% 32%` (#0D9488) | CTA buttons, links |
| `--brand-secondary` | `222 47% 11%` (#111827) | Nav, headings |
| `--brand-accent` | `175 79% 40%` (#14B8A6) | Hover, highlights |
| `--brand-bg` | `0 0% 100%` | Page background |
| `--brand-surface` | `210 40% 98%` | Card background |
| `--brand-text` | `220 13% 26%` (#374151) | Body text |
| `--brand-text-muted` | `220 9% 46%` (#6B7280) | Secondary text |

### Infrastructure

| Component | Config file | Status |
|---|---|---|
| Docker Compose | `docker-compose.yml` | Written — not yet live |
| Nginx | `infrastructure/nginx/` | Written — not yet live |
| CI/CD | `.github/workflows/deploy.yml` | Written — not yet live |
| Hosting | Vultr JHB 4 GB main + 1 GB n8n | Not yet provisioned (#4.1) |

### Migration data (in `migration/raw/`)

| File | Contents | Status |
|---|---|---|
| `products.json` | Raw WooCommerce export (560 products) | Done |
| `products-transformed.json` | Grouped variable/simple (340 products) | Done |
| `printer-brands.json` | 12 printer brands extracted | Done |
| `printer-models.json` | 512 unique models grouped by brand | Done |
| `compat-map-draft.csv` | 249 products mapped — send to client for validation | Awaiting client |
| `compat-gaps.csv` | 91 products with no compat data — client to fill | Awaiting client |
| `image-audit.md` | 309 images audited, 11 low-res, 18 placeholder | Done |
| `plugin-audit.md` | WooCommerce plugin inventory + migration decisions | Done |
| `category-audit.md` | Type → Brand hierarchy decision | Done |
| `attribute-audit.md` | Colour, type, yield coverage | Done |
| `compatibility-audit.md` | No structured compat data in WooCommerce | Done |
| `customers.json` | **NEVER commit — POPIA sensitive** | Awaiting POPIA consent |

---

## Open issues summary

Full issue list: https://github.com/TriNext-Innovations/tse-rework/issues

### Critical path blockers

| # | Issue | Blocked by |
|---|---|---|
| #4.1 | Provision Vultr JHB main VM | Nothing — action now |
| #5.1 | PayFast merchant credentials | Client |
| #2.4 | Map cartridge SKUs to printer models | Client (return compat CSV) |
| #6.8 | Confirm skeleton on dev URL | #4.1 |
| #8.5 | Confirm PayFast sandbox access | Client + #5.1 |

### TriNext actions (no client dependency)

| # | Issue |
|---|---|
| #4.2–#4.10 | Full VM setup chain (after #4.1) |
| #5.4 | Resend transactional email setup |
| #3.5 | Favicon & app icons (after #3.1 logo) |
| #8.2–#8.4 | Governance: deadlines, kickoff call, project tracker |

### Waiting on client

| # | Issue |
|---|---|
| #3.1–#3.4, #3.6 | Logo, brand colours, typography, product photos, brand guidelines |
| #5.2 | Ozow credentials |
| #5.3 | Meta Business access |
| #1.6 | Customer data export (POPIA written consent) |
| #1.7 | Order history export (client decision on scope) |
| #5.6–#5.7 | Aramex + Courier Guy API registration |
