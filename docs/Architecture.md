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
│   └── n8n/              # Exported n8n workflow JSONs
├── docs/                 # This folder — all developer documentation
├── scripts/              # DB seed, migration helpers
├── .env.example
├── turbo.json            # Turborepo monorepo config
└── package.json
```

---

## Stack at a Glance

| Layer              | Technology              | Hosted On                          |
|--------------------|-------------------------|------------------------------------|
| Frontend           | Next.js 15 (App Router) | Vultr JHB VM (Docker + nginx)      |
| Commerce backend   | Medusa.js v2            | Vultr JHB VM (Docker)              |
| Database           | PostgreSQL 16           | Vultr JHB VM (Docker, named vol)   |
| File storage       | Cloudflare R2           | Cloudflare (S3-compatible, free tier) |
| Search             | Meilisearch             | Vultr JHB VM (Docker)              |
| Automation engine  | n8n                     | Vultr JHB n8n VM (Docker)          |
| CDN / DNS          | Cloudflare              | Cloudflare                         |
| Transactional mail | Resend                  | Resend                             |
| Payments           | PayFast + Ozow          | External                           |
| Social API         | Meta Graph API          | External                           |
| AI (captions)      | Anthropic Claude API    | External                           |

> **Two VMs on Vultr JHB:** main VM (4GB RAM, 2 vCPU, 80GB NVMe) runs web + backend + db + meilisearch via Docker Compose. n8n VM (1GB RAM) runs n8n separately to isolate automation workloads.

---

## Data Flow

```
Browser / Mobile
      │
      ▼
Cloudflare CDN (JHB PoP)
      │
      └─── All traffic ────────────────► Vultr JHB Main VM
                                              │
                                         nginx (reverse proxy)
                                         ┌────┴────┐
                                         │         │
                                    :3000          :9000
                                 Next.js         Medusa.js API
                               (App Router)   (REST + custom routes)
                                     │               │
                              Server Components   PostgreSQL 16
                              fetch Medusa SDK    (Docker container)
                                                       │
                                              Meilisearch
                                            (Docker container)
```

---

## Frontend Architecture (`apps/web`)

### App Router Structure

```
apps/web/src/app/
├── (storefront)/
│   ├── layout.tsx              # Root layout with header/footer
│   ├── page.tsx                # Homepage
│   ├── products/
│   │   ├── page.tsx            # Catalogue listing (RSC)
│   │   └── [handle]/page.tsx   # Product detail page
│   ├── compatibility/
│   │   └── page.tsx            # Cartridge compatibility wizard
│   ├── cart/page.tsx
│   ├── checkout/page.tsx
│   ├── account/
│   │   ├── layout.tsx          # Protected layout (auth guard)
│   │   ├── orders/page.tsx
│   │   └── addresses/page.tsx
│   └── b2b/
│       ├── login/page.tsx
│       ├── dashboard/page.tsx
│       └── quote/page.tsx
├── api/
│   ├── revalidate/route.ts     # Medusa webhook → on-demand ISR revalidation
│   └── webhooks/
│       ├── payfast/route.ts
│       └── medusa/route.ts
└── (legal)/
    ├── privacy/page.tsx
    └── cookies/page.tsx
```

### Key Patterns

- **Server Components by default** — fetch data directly from Medusa SDK on the server, no client-side waterfalls
- **Client Components only for interactivity** — cart drawer, quantity selectors, wizard steps
- **Full SSR / ISR** — Next.js runs as a Node.js server in Docker; ISR via `revalidate: 3600` and on-demand via Medusa webhook calls to `/api/revalidate`
- **Optimistic updates** — cart actions use React `useOptimistic` for instant UI feedback

---

## Backend Architecture (`apps/backend`)

Medusa.js v2 uses a modular architecture. Custom modules live in `src/modules/`.

```
apps/backend/src/
├── modules/
│   ├── compatibility/          # Cartridge compatibility data & API
│   ├── b2b/                    # B2B customer groups & pricing
│   └── courier/                # SA courier rate logic
├── api/
│   ├── store/                  # Public storefront API extensions
│   └── admin/                  # Admin panel API extensions
├── workflows/                  # Medusa workflow definitions
│   ├── create-quote.ts
│   └── bulk-order.ts
├── subscribers/                # Event-driven side effects
│   ├── order-placed.ts         # Trigger Resend confirmation email
│   └── product-updated.ts     # Trigger n8n social post workflow
└── medusa-config.ts
```

### Custom Modules

**Compatibility Module**
Stores a `compatibility` table: `printer_brand`, `printer_model`, `cartridge_sku` (FK to Medusa product). The wizard queries this table via a custom `/store/compatibility` endpoint.

**B2B Module**
Extends Medusa's customer groups with `pricing_tier` (ENUM: `standard`, `reseller`, `wholesale`). A custom price list is auto-applied at checkout based on the authenticated customer's group.

**Courier Module**
Wraps the Courier Guy and Aramex APIs. Calculates rates based on order weight, destination province, and the 12:00 cutoff rule for next-day JHB/PTA delivery.

---

## Database Schema (key tables)

All standard Medusa tables are inherited. Custom additions:

```sql
-- Cartridge compatibility
CREATE TABLE compatibility (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand       TEXT NOT NULL,           -- e.g. 'HP'
  model       TEXT NOT NULL,           -- e.g. 'LaserJet Pro M404n'
  sku         TEXT NOT NULL,           -- Medusa product variant SKU
  oem         BOOLEAN DEFAULT false,   -- true = original, false = compatible
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- B2B pricing tiers (extends Medusa customer_group)
ALTER TABLE customer_group ADD COLUMN pricing_tier TEXT DEFAULT 'standard';

-- Quote requests
CREATE TABLE quote_request (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  TEXT NOT NULL,
  items        JSONB NOT NULL,         -- [{sku, qty}]
  note         TEXT,
  status       TEXT DEFAULT 'pending', -- pending | quoted | accepted | rejected
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Environment Variables

See `.env.example` for the full list. Critical vars:

```bash
# Medusa
DATABASE_URL=postgresql://medusa:password@db:5432/tse   # internal Docker network
MEDUSA_BACKEND_URL=https://api.tse-cartridges.co.za

# Vultr Object Storage (S3-compatible)
S3_ENDPOINT=https://jhb1.vultrobjects.com
S3_BUCKET=tse-product-images
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_REGION=jhb1

# PayFast
PAYFAST_MERCHANT_ID=
PAYFAST_MERCHANT_KEY=
PAYFAST_PASSPHRASE=
PAYFAST_SANDBOX=false

# Ozow
OZOW_SITE_CODE=
OZOW_PRIVATE_KEY=
OZOW_API_KEY=

# Sanity
NEXT_PUBLIC_SANITY_PROJECT_ID=
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_TOKEN=

# Meilisearch
MEILISEARCH_HOST=
MEILISEARCH_API_KEY=

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=orders@tse-cartridges.co.za

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

### Vultr JHB Main VM (web + backend + db + search)
All services run via Docker Compose. The `docker-compose.yml` at repo root defines:

| Service       | Image                        | Internal port | External access via nginx |
|---------------|------------------------------|---------------|---------------------------|
| `web`         | Built from `apps/web/`       | 3000          | tse-cartridges.co.za      |
| `backend`     | Built from `apps/backend/`   | 9000          | api.tse-cartridges.co.za  |
| `db`          | `postgres:16`                | 5432          | Internal only             |
| `meilisearch` | `meilisearch/meilisearch`    | 7700          | Internal only             |

**Deploy flow:** push to `main` → GitHub Actions → SSH into VM → `git pull && docker compose up --build -d` → health check → rollback if failed.

**nginx** acts as reverse proxy: routes requests by subdomain to the correct container port. SSL terminated at Cloudflare (Full Strict mode).

### Vultr JHB n8n VM (automation)
- Separate 1GB VM to isolate automation workloads from the main server
- Docker Compose with single `n8n` service
- Same GitHub Actions SSH deploy pattern

### Cloudflare R2 (file storage)
- Bucket: `tse-product-images` (public-read)
- Free tier: 10GB storage + 1M operations/month — more than sufficient for product images
- Zero egress fees when served through Cloudflare CDN
- Connected to Medusa via `@medusajs/file-s3` plugin (R2 is S3-compatible)
- R2 endpoint: `https://<account-id>.r2.cloudflarestorage.com`

### Cloudflare
- DNS: A records `@`, `www`, `api` → Vultr main VM public IP (Proxied)
- SSL/TLS: Full (Strict) — Cloudflare terminates SSL, forwards HTTPS to nginx
- Page rule: bypass cache on `api.tse-cartridges.co.za/*`
- DDoS protection active on all proxied records
