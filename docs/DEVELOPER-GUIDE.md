# TSE Online — Developer Guide

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Desktop (for local Postgres + Meilisearch)
- A Supabase account (free tier fine for dev)
- A Vercel account
- A Railway account

---

## Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-org/tse-online.git
cd tse-online

# 2. Install dependencies
pnpm install

# 3. Copy env files
cp .env.example apps/web/.env.local
cp .env.example apps/backend/.env

# 4. Start local services (Postgres + Meilisearch + n8n)
docker-compose up -d

# 5. Run Medusa migrations
pnpm --filter backend medusa db:migrate

# 6. Seed the database
pnpm --filter backend seed

# 7. Start all apps in dev mode
pnpm dev
```

- Frontend: http://localhost:3000
- Medusa admin: http://localhost:9000/app
- Medusa API: http://localhost:9000
- n8n: http://localhost:5678
- Meilisearch: http://localhost:7700

---

## Git Workflow

```
main          ← production (auto-deploys to Vercel + Railway)
staging       ← pre-production testing
dev           ← integration branch
feature/*     ← your feature branches
fix/*         ← bug fix branches
```

**Branch naming:** `feature/compatibility-wizard`, `fix/payfast-signature`, `chore/update-deps`

**Commit format (Conventional Commits):**
```
feat(wizard): add step 3 results grid
fix(payfast): correct MD5 signature field order
chore(deps): upgrade medusa to 2.1.4
docs(arch): update deployment section
```

**PR process:**
1. Branch off `dev`
2. Open PR → `dev` with description of changes
3. Vercel creates a preview deployment automatically
4. Review + approve → merge to `dev`
5. Weekly: merge `dev` → `staging` for client review
6. After client sign-off: merge `staging` → `main`

---

## Testing

```bash
# Unit tests (Vitest)
pnpm test

# E2E tests (Playwright) — requires local services running
pnpm test:e2e

# Type check all packages
pnpm type-check

# Lint
pnpm lint
```

### Key test areas
- Compatibility wizard: correct SKUs returned for each printer model
- PayFast signature validation: test vectors from PayFast sandbox docs
- Ozow HMAC: test vectors from Ozow developer portal
- B2B pricing: confirm correct discount applied per tier
- Courier zone logic: postal code edge cases

---

## Database Migrations

Migrations live in `apps/backend/src/migrations/`. Always create a new migration file,
never edit existing ones.

```bash
# Create a new migration
pnpm --filter backend medusa db:generate <migration-name>

# Apply pending migrations
pnpm --filter backend medusa db:migrate

# Rollback last migration
pnpm --filter backend medusa db:rollback
```

---

## Seeding Product Data

The client will supply product data as a CSV/spreadsheet. The seed script at
`scripts/seed-products.ts` handles import:

```bash
# Seed from CSV
pnpm --filter backend tsx scripts/seed-products.ts --file ./data/products.csv

# Seed compatibility data (printer model → cartridge SKU mappings)
pnpm --filter backend tsx scripts/seed-compatibility.ts --file ./data/compatibility.csv
```

Expected CSV columns for products:
`sku, title, description, brand, category, price, stock, images, oem`

Expected CSV columns for compatibility:
`printer_brand, printer_model, sku, oem`

---

## PayFast Integration Notes

**Sandbox testing:**
- Merchant ID: `10000100`
- Merchant Key: `46f0cd694581a`
- Passphrase: leave empty in sandbox
- Test cards: https://developers.payfast.co.za/docs#testing

**Signature algorithm:**
1. Build a query string from all non-empty form fields, alphabetically sorted
2. Add passphrase as `passphrase=xxx` at the end (production only)
3. MD5 hash of the query string
4. Compare with `signature` field in ITN POST

**ITN (webhook) validation:**
After signature check, also validate:
- `payment_status` === `"COMPLETE"`
- `amount_gross` matches the order total in your DB (prevent tampering)
- `item_name` matches your order reference

---

## Meta Graph API Notes (Instagram/Facebook bot)

**Token setup:**
1. Create a Meta App at developers.facebook.com
2. Add "Instagram Graph API" product
3. Generate a long-lived User Access Token (valid 60 days)
4. Exchange for a never-expiring Page Access Token
5. Get the Instagram Business Account ID linked to the TSE Facebook Page

**Posting flow:**
```
POST /{ig-user-id}/media
  { image_url, caption, access_token }
  → returns { id: "creation_id" }

POST /{ig-user-id}/media_publish
  { creation_id, access_token }
  → returns { id: "media_id" }
```

**Rate limits:** 25 posts per 24 hours per Instagram Business account.
n8n workflow enforces a minimum 30-minute gap between posts.

---

## n8n Workflow Management

n8n workflows are version-controlled as JSON exports in `automation/n8n/`.

**Export a workflow:**
1. Open workflow in n8n UI
2. Menu → Download → save to `automation/n8n/<workflow-name>.json`
3. Commit with the code that triggered the workflow change

**Import a workflow:**
1. n8n UI → New workflow → Import from file
2. Or use n8n CLI: `n8n import:workflow --input=automation/n8n/social-posting-workflow.json`

**Active workflows in production:**
- `social-posting-workflow.json` — Instagram/Facebook auto-posting
- `cart-abandonment-workflow.json` — WhatsApp recovery (24hr delay)
- `restock-alert-workflow.json` — Email/WhatsApp alert to B2B customers on restock

---

## Sanity CMS — Owner Content

The client manages the following content in Sanity (no developer needed):
- Homepage hero banner (image, headline, CTA link)
- Promotional banners (e.g. "10% off this week")
- About page copy
- Blog posts (for SEO)

**Schema files:** `apps/web/src/sanity/schemas/`
**Studio URL (production):** https://tseonline.sanity.studio

To add a new content type: add a schema file, export from `schemas/index.ts`, redeploy Sanity Studio.

---

## Monitoring & Alerts

- **Vercel Analytics** — Core Web Vitals, traffic, error rates
- **Railway metrics** — CPU, memory, request volume for Medusa
- **Sentry** — Error tracking across frontend and backend
  - Set `SENTRY_DSN` in both web and backend env vars
- **Uptime monitoring** — UptimeRobot free tier, checks `/health` every 5 minutes
  - Medusa health endpoint: `/health`
  - Meilisearch health: `/health`

---

## Going Live Checklist

- [ ] All env vars set in Vercel and Railway for production
- [ ] PayFast switched to production credentials (`PAYFAST_SANDBOX=false`)
- [ ] Meta App reviewed and approved for `instagram_basic`, `instagram_content_publish`
- [ ] Cloudflare DNS records set and proxied
- [ ] SSL certificates auto-issued by Cloudflare / Vercel
- [ ] Google Analytics configured and cookie banner tested
- [ ] POPIA Privacy Policy and Cookie Policy pages live
- [ ] All Medusa migrations run on production DB
- [ ] Product data fully seeded and reviewed by client
- [ ] Compatibility data loaded and wizard tested with 10+ printer models
- [ ] PayFast ITN webhook URL registered in PayFast merchant portal
- [ ] Ozow webhook URL registered in Ozow merchant portal
- [ ] n8n workflows imported and activated in production
- [ ] Test order placed end-to-end (PayFast sandbox → production)
- [ ] Resend domain verification complete (SPF + DKIM for tseonline.co.za)
- [ ] Sentry error tracking confirmed receiving events
- [ ] UptimeRobot monitoring active
- [ ] Client training session completed (Sanity CMS + order management)
- [ ] DNS cutover from old site performed during low-traffic window
