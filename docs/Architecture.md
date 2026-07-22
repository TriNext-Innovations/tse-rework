# TSE Online — Architecture Overview

## Project Structure

```
tse-online/
├── apps/
│   ├── web/              # Next.js 15 frontend (App Router)
│   └── backend/          # Medusa.js v2 commerce backend
├── packages/
│   ├── ui/               # Shared shadcn/ui component library
│   ├── config/           # Shared Tailwind, ESLint, TS configs
│   └── types/            # Shared TypeScript types
├── automation/
│   └── n8n/              # Empty (.gitkeep only) — n8n itself runs on
│                          # separate infrastructure, not in this repo's
│                          # docker-compose. This folder is only a place to
│                          # version-control exported workflow JSON if that
│                          # ever gets set up — nothing has been committed here yet.
├── docs/                 # This folder — all developer documentation
├── scripts/              # DB seed, migration helpers
├── .env.example
├── turbo.json            # Turborepo monorepo config
└── package.json
```

---

## Stack at a Glance

> **Reconciled 2026-07-22 against the actual running system** — this table
> drifted significantly from reality during build (see git history: the
> Coolify/Supabase/Resend/n8n-on-same-VM plan documented below was never
> actually built that way). Corrected against direct verification: prod SSH
> access, `docker compose ps` on the box, and `grep` over `apps/`. Anything
> still marked "unconfirmed" wasn't checked directly — verify before relying
> on it.

| Layer              | Technology                        | Hosted On                          |
|--------------------|------------------------------------|-------------------------------------|
| Frontend           | Next.js 16 (App Router)           | Single VM, plain Docker Compose     |
| Commerce backend   | Medusa.js v2                      | Same VM                             |
| Database           | PostgreSQL 16 (self-hosted Docker) | Same VM, **not** Supabase           |
| File storage       | Cloudflare R2                     | Cloudflare                          |
| Cache / queues     | Redis                             | Same VM                             |
| Search             | Meilisearch                       | Same VM                             |
| CMS                | *(none)*                          | Sanity was planned, never integrated — zero references anywhere in `apps/` |
| Automation engine  | n8n                               | **Separate infrastructure**, managed outside this repo — deliberately isolated from the prod VM. Not deployed via this repo's docker-compose. |
| CDN / DNS          | Cloudflare                        | Cloudflare (JHB PoP)                |
| Transactional mail | ZeptoMail (Zoho)                  | ZeptoMail — **not** Resend (see `apps/backend/src/lib/email.ts`) |
| Payments           | PayFast (live); Ozow (env vars reserved, no provider implemented in code) | External |
| Social API         | Meta Graph API                    | External — status of the n8n-side integration unconfirmed from this repo |
| AI (captions)      | Anthropic Claude API              | External                            |
| Error tracking     | Bugsink (self-hosted, Sentry-compatible) | Same VM — not in the original plan at all |

There is no Coolify anywhere in this stack — deploy is a plain
`docker compose up --build -d` over SSH from GitHub Actions
(`.github/workflows/deploy.yml`). See `docs/PROD-DEPLOY.md` for the real
runbook and `README.md` for current status; both are kept live and are more
trustworthy than the rest of this file for anything infra-related.

---

## Data Flow

```
Browser / Mobile
      │
      ▼
Cloudflare CDN (JHB PoP)   ← DNS + DDoS + SSL at edge
      │
      ▼
Single VM — plain Docker Compose (no Coolify; see docs/PROD-DEPLOY.md)
      │
      ├── Next.js 16  (port 3000)
      │     │
      │     └── Server Components ──► Medusa.js API (port 9000)
      │                                     │
      │                          ┌──────────┴──────────┐
      │                          │                      │
      │                     PostgreSQL 16          Meilisearch
      │                  (self-hosted Docker,       (port 7700)
      │                   same VM — not Supabase)
      │
      ├── Redis     (port 6379 — internal only)
      └── Bugsink   (self-hosted, Sentry-compatible error tracking)

n8n runs on separate infrastructure outside this repo's scope, isolated
from the VM above. It calls Medusa's public Admin API
(`api.tse-cartridges.co.za/admin/*`) rather than an internal Docker route —
there's no loopback path in from external infra. Anthropic API and Meta
Graph API integration status on the n8n side is not tracked in this repo.

There is no CMS in production. Sanity was the original plan but was never
integrated — confirm with the client whether it's still wanted before
building anything that assumes it exists.
```

---

## Frontend Architecture (`apps/web`)

### App Router Structure

> Illustrative, not exhaustively verified leaf-by-leaf — but the two
> API routes below were checked directly and don't exist. The only real
> route under `apps/web/src/app/api/` today is `health/route.ts`. There is
> no Sanity revalidation webhook (no CMS in production at all) and no
> `webhooks/payfast` or `webhooks/medusa` route in the web app — PayFast's
> ITN and any Medusa-side webhook handling live in `apps/backend`, not here.

```
apps/web/src/app/
├── (storefront)/
│   ├── layout.tsx
│   ├── page.tsx                # Homepage
│   ├── products/
│   │   ├── page.tsx            # Catalogue listing (RSC)
│   │   └── [handle]/page.tsx   # Product detail page
│   ├── compatibility/page.tsx  # Cartridge compatibility wizard
│   ├── cart/page.tsx
│   ├── checkout/page.tsx
│   ├── account/                # orders, addresses, auth guard
│   ├── b2b/                    # login, dashboard, quote
│   └── legal/                  # privacy, cookies
├── api/
│   └── health/route.ts
├── sitemap.ts
├── robots.ts
├── opengraph-image.tsx
└── feed/google-merchant.xml/route.ts   # Google Merchant Center feed
```

### Key Patterns

- **Server Components by default** — fetch data directly from Medusa SDK on the server, no client-side waterfalls
- **Client Components only for interactivity** — cart drawer, quantity selectors, wizard steps
- **ISR for product pages** — `revalidate: 3600` (1 hour), on-demand revalidation via Medusa webhooks
- **Optimistic updates** — cart actions use React `useOptimistic` for instant UI feedback

---

## Backend Architecture (`apps/backend`)

Medusa.js v2 uses a modular architecture. Custom modules live in `src/modules/`.

```
apps/backend/src/
├── modules/
│   ├── compatibility/           # Cartridge compatibility data & API
│   ├── courier-guy/             # The Courier Guy (ShipLogic) rate + waybill API
│   └── payfast/                 # AbstractPaymentProvider for PayFast
├── api/
│   ├── store/                   # b2b, compatibility, data-requests, payment-surveys, search
│   └── admin/                   # Admin panel API extensions
├── admin/widgets/                # e.g. customer-b2b-tier.tsx
├── scripts/                     # setup-b2b-groups.ts, setup-b2b-pricing.ts, seed*, migrate*
├── subscribers/                  # order-placed, order-shipment-created, password-reset,
│                                  # payment-captured, search-sync
└── medusa-config.ts
```

There is no `apps/backend/src/workflows/` directory — confirmed absent.
No `product-updated` / `inventory-restocked` subscribers either; nothing in
this repo currently triggers n8n automatically. If/when that's wired up
(see the marketing-automation retainer pillar), it'll need building.

### Custom Modules

**Compatibility Module**
Real, at `modules/compatibility/`. Backs the `/store/compatibility` endpoint the wizard queries.

**B2B pricing** *(not a custom module — corrected)*
Implemented via Medusa's **native** customer groups + price lists, set up by `scripts/setup-b2b-groups.ts` and `scripts/setup-b2b-pricing.ts`, not a bespoke `pricing_tier` column or a `modules/b2b/` directory (neither exists). The admin side has a `customer-b2b-tier.tsx` widget. Quote requests are handled by the `api/store/b2b/quote` route directly — there's no separate `create-quote` workflow file.

**Courier module** *(renamed from what's documented)*
Real module is `modules/courier-guy/` — The Courier Guy (ShipLogic) only. No Aramex integration found anywhere in `apps/backend/src` — if Aramex is still planned, it hasn't been built.

**PayFast module**
Real, at `modules/payfast/` — an `AbstractPaymentProvider` implementation, conditionally registered in `medusa-config.ts` only when merchant credentials are present. Ozow has reserved env vars (`OZOW_*` in `.env.example`, referenced in `PROD-DEPLOY.md`) but no provider module exists in code — treat it as not implemented, not as "done."

---

## Database Schema (key tables)

All standard Medusa tables are inherited. The compatibility schema below is
confirmed directly against prod (`printer_brand`, `printer_model`,
`cartridge_compat` all exist as real tables) — this replaces a
previously-documented flat `compatibility` table that was never actually
built that way.

```sql
-- Cartridge compatibility — three tables, not one flat table
printer_brand      (id, name, slug, ...)
printer_model      (id, name, slug, brand_id FK, search_name, validated, ...)
cartridge_compat   (id, sku, source, printer_model_id FK, ...)
-- `source` tags the batch a compat row came from (e.g. 'gap-fill'), so
-- imports stay auditable and reversible — see docs/data-model.md.
```

**B2B pricing tier**: there is no `customer_group.pricing_tier` column.
B2B pricing uses Medusa's native customer-group + price-list mechanism
directly (see `scripts/setup-b2b-groups.ts` / `setup-b2b-pricing.ts`) — no
custom schema addition.

**Quote requests**: no `quote_request` table exists in the database
(checked directly). The real quote feature lives at `api/store/b2b/quote`
— how it actually persists or notifies wasn't traced as part of this pass;
don't assume the schema above until someone reads that route.

---

## Environment Variables

See `.env.example` for the full list. Critical vars:

```bash
# Medusa — self-hosted Postgres, not Supabase (POSTGRES_PASSWORD backs this
# for both the app and medusa-migrate; don't rotate without recreating the
# postgres volume — see docs/PROD-DEPLOY.md)
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@postgres:5432/tse_medusa
MEDUSA_BACKEND_URL=https://api.tse-cartridges.co.za

# PayFast
PAYFAST_MERCHANT_ID=
PAYFAST_MERCHANT_KEY=
PAYFAST_PASSPHRASE=
PAYFAST_SANDBOX=false

# Ozow
OZOW_SITE_CODE=
OZOW_PRIVATE_KEY=
OZOW_API_KEY=

# Sanity — NOT in use. No CMS is integrated in production; these vars
# don't exist in the real .env.example. Left here only as a reminder this
# was the original plan — confirm with the client before building anything
# against it.

# Meilisearch
MEILISEARCH_HOST=
MEILISEARCH_API_KEY=

# ZeptoMail
ZEPTOMAIL_TOKEN=
EMAIL_FROM=sales@tse-cartridges.co.za
EMAIL_REPLY_TO=sales@tse.co.za

# Anthropic (caption generation)
ANTHROPIC_API_KEY=

# Meta Graph API (Instagram/Facebook)
META_ACCESS_TOKEN=
META_INSTAGRAM_BUSINESS_ID=
META_FACEBOOK_PAGE_ID=

# n8n
N8N_WEBHOOK_SECRET=
```

---

## Deployment

**No Coolify.** All production services run on a single VM via plain
Docker Compose. Push to `main` → `.github/workflows/deploy.yml` SSHes in,
runs `docker compose up --build -d`, health-checks Medusa and Next.js
through nginx, rolls back on failure. See `docs/PROD-DEPLOY.md` for the
real runbook — first-run sequence, TLS bootstrap gotcha, rolling-deploy
detail — and `README.md` for current status.

### Service layout (docker-compose, not Coolify)

| Service      | Internal port          | Public URL                              |
|--------------|-------------------------|------------------------------------------|
| Next.js 16   | 3000 (loopback only)   | `tse-cartridges.co.za` (via nginx + Cloudflare) |
| Medusa v2    | 9000 (loopback only)   | `api.tse-cartridges.co.za`                |
| Postgres     | 5432                    | Internal only — self-hosted, not Supabase |
| Redis        | 6379                    | Internal only                             |
| Meilisearch  | 7700                    | Internal only (proxied at `/meili` on the apex for client-side search) |
| Bugsink      | —                       | Loopback-only UI (SSH tunnel); browser errors via an nginx path |
| n8n          | —                       | **Not on this VM at all** — separate infrastructure |

- Env vars live in a plain `.env` file on the server (no Coolify panel)
- TLS via Let's Encrypt/certbot, bootstrapped standalone before nginx starts (chicken-and-egg — see PROD-DEPLOY.md)
- Backups: nightly `pg_dump` cron → local + Cloudflare R2 (see memory/ops notes) — not a Coolify VPS snapshot

### Database
- Self-hosted PostgreSQL 16 in Docker, same VM — **not Supabase**
- No cross-border transfer of the primary DB, and no Row Level Security setup (that was a Supabase-specific mechanism; doesn't apply here)
- Migrations managed via `scripts/migrate.sh` / `medusa migrations run`
- **If this changes the POPIA cross-border analysis in `BUILD-PLAN.md` §10** (which assumes Supabase US/EU hosting), that section needs a compliance re-review — flagging, not resolving, since that's a legal judgment call, not a technical fact

### Cloudflare
- DNS: `tse-cartridges.co.za` and `api.tse-cartridges.co.za` → VM IP (orange-cloud proxied)
- SSL/TLS mode: **Full (Strict)**
- VM firewall: accept HTTP/HTTPS only from Cloudflare IP ranges
