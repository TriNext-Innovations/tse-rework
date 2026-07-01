# TSE Online — Developer Guide

## Stack

| Layer | Technology |
|---|---|
| Storefront | Next.js 15 (App Router, React 19) |
| Commerce engine | Medusa v2 (self-hosted) |
| Database | PostgreSQL 16 |
| Cache / queues | Redis 7 |
| Package manager | pnpm 9 (workspace monorepo) |
| Local infra | Docker Desktop (Postgres + Redis only) |
| Production hosting | Vultr JHB (planned — Milestone 3) |

---

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Desktop (running)
- Git

---

## First-time local setup

### 1. Clone and install

```bash
git clone <repo-url>
cd tse-ui
pnpm install
```

> **Note:** A `.npmrc` at the repo root hoists `@medusajs/*`, `react`, and `react-dom` so
> Vite (Medusa admin bundler) can find them. Do not delete it.

### 2. Start Docker services

```bash
docker-compose up -d
```

This starts **Postgres on :5432** and **Redis on :6379**. Medusa runs locally (not in Docker).

### 3. Create backend env file

Copy and edit:

```bash
cp apps/backend/.env.example apps/backend/.env   # if example exists
```

Minimum contents for `apps/backend/.env`:

```env
DATABASE_URL=postgresql://postgres:tse_local_dev@localhost:5432/tse_medusa
REDIS_URL=redis://localhost:6379
JWT_SECRET=local-dev-jwt-secret-tse
COOKIE_SECRET=local-dev-cookie-secret-tse
MEDUSA_BACKEND_URL=http://localhost:9000
MEDUSA_WORKER_MODE=shared
DISABLE_MEDUSA_ADMIN=false
STORE_CORS=http://localhost:3000,http://localhost:3001
ADMIN_CORS=http://localhost:9000
AUTH_CORS=http://localhost:9000,http://localhost:3000,http://localhost:3001
MEDUSA_ADMIN_EMAIL=admin@tse.co.za
MEDUSA_ADMIN_PASSWORD=TseAdmin2026!
STOREFRONT_URL=http://localhost:3001
```

### 4. Run Medusa migrations

```bash
pnpm --filter @tse/backend migrate
```

### 5. Start Medusa

```bash
pnpm --filter @tse/backend dev
```

Admin dashboard: http://localhost:9000/app  
API: http://localhost:9000

### 6. Seed the database

Requires Medusa running. From the repo root:

```bash
pnpm tsx scripts/seed.ts
```

This seeds (idempotent — safe to run again):
- South Africa region (ZAR)
- TSE Online Storefront sales channel
- Category hierarchy: Inkjet Cartridges → brands, Laser Cartridges → brands
- All 559 products from `migration/raw/products.json`
- Links all products to the sales channel

### 7. Create a publishable API key

After seeding, create the storefront API key via the Medusa Admin API (one-time per environment):

```bash
# Authenticate
TOKEN=$(curl -s -X POST http://localhost:9000/auth/user/emailpass \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tse.co.za","password":"TseAdmin2026!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Create key
KEY_ID=$(curl -s -X POST http://localhost:9000/admin/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"TSE Online Storefront","type":"publishable"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['api_key']['id'])")

TOKEN_VALUE=$(curl -s http://localhost:9000/admin/api-keys/$KEY_ID \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['api_key']['token'])")

# Link to sales channel (get channel ID from seed output or admin UI)
CHANNEL_ID=<paste sc_... id from seed output>

curl -s -X POST "http://localhost:9000/admin/api-keys/$KEY_ID/sales-channels" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"add\":[\"$CHANNEL_ID\"]}"

echo "Add to apps/web/.env.local:"
echo "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$TOKEN_VALUE"
```

Or do it through the admin UI: **Settings → API Keys → Create → link to TSE Online Storefront channel**.

### 8. Create web env file

`apps/web/.env.local`:

```env
NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_<your-key>
```

### 9. Start the storefront

```bash
pnpm --filter @tse/web dev
```

Storefront: http://localhost:3001

---

## Daily dev workflow

```bash
# Terminal 1 — infrastructure
docker-compose up -d

# Terminal 2 — Medusa backend
pnpm --filter @tse/backend dev

# Terminal 3 — Next.js storefront
pnpm --filter @tse/web dev
```

---

## Known gotchas and fixes

### esbuild version conflict
pnpm overrides in root `package.json` pin esbuild to `0.25.6`. If you see
`Expected X but got Y` on install, the override is missing or was removed.

### Medusa admin blank screen
Requires `@medusajs/dashboard`, `react`, and `react-dom` as explicit deps in
`apps/backend/package.json`, plus `.npmrc` hoisting. Both are committed.

### `Cannot find module '@medusajs/admin-sdk'`
`@medusajs/draft-order` requires `@medusajs/admin-sdk@2.13.6` exactly.
Pinned via pnpm override in root `package.json`.

### `Cannot find module '@medusajs/framework/utils'`
`apps/backend/tsconfig.json` must use `moduleResolution: "bundler"` (not `"node"`)
to resolve package.json `exports` subpath entries.

### `ts-node` missing
Medusa CLI needs ts-node to load `medusa-config.ts`. It must be in
`apps/backend/package.json` devDependencies. The tsconfig includes a
`ts-node: { transpileOnly: true }` block to bypass type errors at runtime.

### CORS errors in storefront
`STORE_CORS` in `apps/backend/.env` must include the storefront origin.
Default is `:3000` but `pnpm dev` may allocate `:3001` if `:3000` is taken.
Set both: `STORE_CORS=http://localhost:3000,http://localhost:3001`.

### Store API returns 0 products
Two things must be true:
1. Products must be linked to a sales channel that the publishable key is also linked to.
2. A `region_id` must be passed to get `calculated_price` on variants.

### Shipping option creation fails: "Providers are not allowed"
The fulfillment provider (`manual_manual`) must be associated with the stock location via
`POST /admin/stock-locations/:id/fulfillment-providers` before shipping options can be created.
The seed script handles this automatically.

### `GET /admin/fulfillment-sets/:id` returns HTML
This endpoint does not exist in Medusa v2. Retrieve fulfillment sets and service zones via
`GET /admin/stock-locations/:id?fields=*fulfillment_sets,*fulfillment_sets.service_zones`.

---

## Project structure

```
tse-ui/
├── apps/
│   ├── backend/          Medusa v2 backend
│   │   ├── src/
│   │   │   └── admin/    Custom admin widgets & routes
│   │   ├── medusa-config.ts
│   │   └── .env          Local env (not committed)
│   └── web/              Next.js 15 storefront
│       ├── src/
│       │   ├── app/
│       │   │   ├── (storefront)/   Public-facing pages
│       │   │   └── (main)/         Other routes
│       │   ├── components/
│       │   └── lib/
│       │       └── medusa.ts       SDK client
│       └── .env.local    Local env (not committed)
├── scripts/
│   └── seed.ts           Database seed script
├── migration/
│   └── raw/
│       └── products.json WooCommerce export (559 products)
├── docker-compose.yml    Postgres + Redis
├── .npmrc               pnpm hoisting config
└── package.json         Root — pnpm overrides live here
```

---

## Git workflow

```
main          ← production
initial/      ← Phase-0 build branch (current)
feature/*     ← feature branches off initial/ or main
fix/*         ← bug fixes
```

**Commit format (Conventional Commits):**
```
feat(storefront): add products listing page with category filters
fix(seed): handle empty price field on Epson T7024
chore(deps): pin @medusajs/admin-sdk to 2.13.6
```

---

## Database — what's seeded

| Entity | Count | Notes |
|---|---|---|
| Regions | 1 | South Africa / ZAR |
| Sales channels | 1 | TSE Online Storefront |
| Categories | 14 | 2 parents (Inkjet, Laser) + 12 brand leaves |
| Products | 559 | All from WooCommerce export |
| Stock location | 1 | Kya Sands Warehouse |
| Shipping options | 2 | JHB/PTA Own Delivery (COD, R0), Nationwide Courier (R129) |
| Publishable API key | 1 | Manual step post-seed |

### Missing for full checkout (Phase 1)
- **Payment providers** — PayFast and/or Ozow (configured at Milestone 3)

---

## POPIA / sensitive data rules

- `migration/raw/customers.json` — **NEVER commit** — contains real customer PII
- `migration/raw/orders.json` — **NEVER commit** — contains real order history
- Real customer/order data must only ever be migrated to the production Vultr JHB server
- Synthetic data only in seed scripts

---

## Going live checklist (Milestone 3)

- [ ] Vultr JHB server provisioned, Docker stack deployed
- [ ] Domain DNS pointed to Vultr (tse-cartridges.co.za)
- [ ] SSL via Caddy or nginx + Let's Encrypt
- [ ] All env vars set for production
- [ ] Medusa migrations run on production DB
- [ ] Product data seeded and reviewed by client
- [ ] Publishable API key created for production
- [ ] Shipping options configured in Medusa admin
- [ ] PayFast credentials configured (PAYFAST_SANDBOX=false)
- [ ] POPIA Privacy Policy page live
- [ ] Test order placed end-to-end
- [ ] New site live at `tse-cartridges.co.za` running **side by side** with the existing WooCommerce site (`tse.co.za`) — no hard cutover. Both sites stay online in parallel; the old site is only wound down later once the new one is proven in production (see `docs/CLIENT-PENDING.md` #8)
