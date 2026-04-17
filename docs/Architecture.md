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

| Layer              | Technology              | Hosted On         |
|--------------------|-------------------------|-------------------|
| Frontend           | Next.js 15 (App Router) | Vercel Pro        |
| Commerce backend   | Medusa.js v2            | Railway           |
| Database           | PostgreSQL (Supabase)   | Supabase          |
| File storage       | Supabase Storage        | Supabase          |
| Search             | Meilisearch             | Railway           |
| CMS                | Sanity                  | Sanity Cloud      |
| Automation engine  | n8n                     | Railway           |
| CDN / DNS          | Cloudflare              | Cloudflare        |
| Transactional mail | Resend                  | Resend            |
| Payments           | PayFast + Ozow          | External          |
| Social API         | Meta Graph API          | External          |
| AI (captions)      | Anthropic Claude API    | External          |

---

## Data Flow

```
Browser / Mobile
      │
      ▼
Cloudflare CDN (JHB PoP)
      │
      ├─── Static assets, ISR pages ──► Vercel Edge
      │
      └─── API routes / RSC ──────────► Vercel Serverless
                                              │
                                    Next.js App Router
                                    (Server Components)
                                              │
                              ┌───────────────┴────────────────┐
                              │                                 │
                       Medusa.js API                       Sanity CMS
                    (REST + custom routes)              (marketing content)
                              │
                    ┌─────────┴──────────┐
                    │                    │
               Supabase DB          Meilisearch
            (PostgreSQL + RLS)     (product search)
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
│   ├── revalidate/route.ts     # Sanity webhook revalidation
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
- **ISR for product pages** — `revalidate: 3600` (1 hour), on-demand revalidation via Medusa webhooks
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
DATABASE_URL=postgresql://...
MEDUSA_BACKEND_URL=https://api.tseonline.co.za

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

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
RESEND_FROM_EMAIL=orders@tseonline.co.za

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

### Vercel (frontend)
- Connect GitHub repo → Vercel project
- Set `apps/web` as root directory
- All env vars set in Vercel dashboard
- Preview deployments on every PR

### Railway (Medusa backend + n8n + Meilisearch)
- Three Railway services in one project
- Medusa: Dockerfile in `apps/backend/`
- n8n: official Railway template
- Meilisearch: official Railway template
- All share a private Railway network — Medusa calls Meilisearch internally

### Supabase
- One project, `production` environment
- Row Level Security (RLS) enabled on all tables
- Migrations managed via `scripts/migrate.sh`

### Cloudflare
- DNS: point `tseonline.co.za` → Vercel, `api.tseonline.co.za` → Railway
- Enable "Proxied" on both A records for CDN + DDoS protection
- Page rule: cache static assets aggressively, bypass cache on `/api/*`
