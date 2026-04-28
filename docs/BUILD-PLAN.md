# TSE Online — Build Plan & Architecture Scope

Companion to `docs/Architecture.md`. That document describes the **target system**;
this one describes the **path to get there** — what is already in place, what
is missing, and the order in which we will build it during the upcoming
implementation phase.

- **Project start:** April 2026
- **Go-live target:** June 2026
- **Branch for this scoping work:** `feature/setup`

---

## 1. Why this document exists

Before we cut feature branches and start churning out modules, we need a single
place that answers:

1. What does the repo already give us for free?
2. What's the gap between today and a sellable v1?
3. What order do we build it in so we never block ourselves?
4. What decisions does the client still need to make?

Everything below is intended to be lived-in. Update it as we go — don't
let it rot into proposal fiction.

---

## 2. Current state of the repo

### 2.1 Already scaffolded

| Area | Status | Notes |
|---|---|---|
| Turborepo + pnpm workspaces | Done | `turbo.json`, `pnpm-workspace.yaml`, root `package.json` |
| `apps/web` — Next.js 15 (App Router, TS, Tailwind) | Skeleton | `src/app/(storefront)/page.tsx` lists 4 POCs |
| `apps/web` — design POCs `/one` `/two` `/three` `/four` | Done | Owner-facing concept review |
| `apps/web/proposal` page | Done | Live proposal artefact |
| `apps/backend` — Medusa.js v2 | Skeleton | `medusa-config.ts` only, `modules: []` |
| `packages/ui` | Stub | Only `lib/utils` exported |
| `packages/config` | Done | Tailwind, ESLint, tsconfig presets |
| `packages/types` | Done | `product`, `cart`, `customer`, `compatibility`, `b2b` |
| `automation/n8n` | Empty | `.gitkeep` only |
| `scripts/migrate.sh` | Done | Wraps `medusa migrations run/revert/show` |
| `.env.example` | Done | All third-party secrets stubbed |
| Docs (`Architecture`, `Developer Guide`, `Retainer`, `AI Prompts`) | Done | Reference, do not duplicate |

### 2.2 Known gaps (this is the build backlog)

- No real Medusa modules — `compatibility/`, `b2b/`, `courier/`, `payfast/`, `ozow/` all need to be created
- No subscribers (`order-placed`, `product-updated`, `search-sync`)
- No workflows (`create-quote`, `bulk-order`)
- No storefront commerce surfaces — `products/`, `products/[handle]/`, `cart/`, `checkout/`, `account/*`, `compatibility/`, `b2b/*` are not yet built
- No payment flows wired up (PayFast ITN, Ozow webhook)
- No transactional emails (Resend + React Email templates)
- No search (Meilisearch index + sync + UI)
- No CMS (Sanity studio + schemas + revalidation webhook)
- No POPIA layer (cookie banner, privacy/cookies pages, data-requests endpoint)
- No courier integration (Courier Guy / Aramex)
- No admin extensions (compatibility widget, B2B tier widget, social posts widget, quotes route)
- No tests (Vitest unit, Playwright E2E)
- No `docker-compose.yml` despite the dev guide referencing it
- No CI (lint / type-check / test on PRs)

---

## 3. Target architecture (1-line summary)

```
Next.js 15 (Vercel)  ──►  Medusa v2 (Railway) ──►  Postgres (Supabase)
                  │                  │
                  ├──► Sanity CMS    ├──► Meilisearch (Railway)
                  ├──► Resend        ├──► n8n (Railway)
                  └──► PayFast/Ozow  └──► Meta Graph + Anthropic (via n8n)
```

For full data flow, env vars, and DB extensions see `docs/Architecture.md`.

---

## 4. Phased build (six weeks)

The phases are sequenced so each one unblocks the next. Each phase ends with
something demonstrable to the client.

### Phase 0 — Foundations (this week, on `feature/setup`)

Goal: a developer can clone the repo and have `pnpm dev` boot a working
Medusa + Next.js + Postgres + Meilisearch stack within ten minutes.

- [ ] Add `docker-compose.yml` for local Postgres, Redis, Meilisearch, n8n
- [ ] Wire `apps/backend` so `medusa develop` actually starts (currently `modules: []` and no `src/` entrypoint files beyond config)
- [ ] Pick the production design POC and promote its layout into a real
      `(storefront)/layout.tsx` with header/footer placeholders
- [ ] Move `/one`–`/four` POC routes under `apps/web/src/app/poc/` so the
      storefront root is free for the real homepage
- [ ] Add CI workflow: `lint`, `type-check`, `build` on every PR
- [ ] Add Husky + lint-staged + Conventional Commits enforcement
- [ ] Confirm Supabase project is provisioned and `DATABASE_URL` works

**Exit criteria:** green CI, fresh clone boots end-to-end, design direction locked.

### Phase 1 — Design system & catalogue (week 2)

Maps to AI prompts 2 and 12.

- [ ] Build `packages/ui` components: `Button`, `Badge`, `ProductCard`,
      `CartDrawer`, `CompatibilityBadge`, `PricingTierBadge`
- [ ] Replace `apps/web/src/components/mockup-nav.tsx` with the real Header
      (sticky, blur, cart count, account icon, CMD+K trigger)
- [ ] Build `(storefront)/products/page.tsx` (catalogue grid, RSC, pagination)
- [ ] Build `(storefront)/products/[handle]/page.tsx` with `generateMetadata`
      and JSON-LD Product schema
- [ ] Seed Medusa with placeholder products from existing `assets/` images so
      the catalogue is populated for review

**Exit criteria:** client can browse a real catalogue end-to-end on a
preview URL.

### Phase 2 — Compatibility wizard & search (week 3)

Maps to AI prompts 3 and 8.

- [ ] Backend `modules/compatibility/` + table migration + service
- [ ] `/store/compatibility/{brands,models,cartridges}` REST endpoints
- [ ] `(storefront)/compatibility/page.tsx` 3-step wizard (Client Component)
- [ ] Meilisearch index, `search-sync` subscriber, bulk-index script
- [ ] Header CMD+K `SearchModal` with Meilisearch adapter and filters
- [ ] Compatibility CSV importer in `scripts/seed-compatibility.ts`

**Exit criteria:** typing "M404n" or selecting HP → LaserJet Pro M404n returns
the right cartridges, in stock and out.

### Phase 3 — Cart, checkout & payments (week 4)

Maps to AI prompts 4 and 7. Highest-risk phase — start payment integration
work first.

- [ ] Cart drawer wired to Medusa cart, `useOptimistic` for qty changes
- [ ] `(storefront)/cart/page.tsx` and `(storefront)/checkout/page.tsx`
- [ ] `modules/payfast/` AbstractPaymentProvider + ITN webhook + signature validation
- [ ] `modules/ozow/` AbstractPaymentProvider + HMAC-SHA512 webhook
- [ ] `modules/courier/` (rate calc, Courier Guy + Aramex, 12:00 cutoff, flat-rate fallback)
- [ ] React Email templates: `OrderConfirmation`, `ShippingUpdate`, `PasswordReset`
- [ ] Resend wiring in `apps/backend/src/lib/email.ts`
- [ ] `subscribers/order-placed.ts` triggers confirmation email

**Exit criteria:** test order placed end-to-end against PayFast sandbox,
confirmation email received, courier rate displayed at checkout.

### Phase 4 — B2B, accounts & CMS (week 5)

Maps to AI prompts 5 and 11, plus Sanity setup.

- [ ] `modules/b2b/` with `pricing_tier` + auto-applied price lists
- [ ] `(storefront)/account/*` (orders, addresses, password reset)
- [ ] `(storefront)/b2b/login`, `b2b/dashboard`, `b2b/quote`
- [ ] `quote_request` table + `POST /store/b2b/quote` + admin email via Resend
- [ ] Admin widgets: compatibility, B2B tier, social posts, quotes route
- [ ] Sanity studio with schemas: `homepageHero`, `promoBanner`, `aboutPage`, `blogPost`
- [ ] `/api/revalidate` route for Sanity webhook → on-demand ISR

**Exit criteria:** client can log in as a reseller and see reseller pricing;
client can publish a homepage banner from Sanity and see it live within seconds.

### Phase 5 — Automation, POPIA & launch hardening (week 6)

Maps to AI prompts 6, 9, 10, 12.

- [ ] n8n workflow `social-posting-workflow.json` (Anthropic caption + Meta Graph)
- [ ] `subscribers/product-updated.ts` triggers n8n on create/restock
- [ ] `subscribers/cart-abandoned.ts` triggers n8n WhatsApp recovery
- [ ] `social_posts` Supabase table + admin "Post Now" button
- [ ] POPIA: `CookieBanner`, `(legal)/privacy`, `(legal)/cookies`,
      `/store/data-requests` endpoint
- [ ] `sitemap.ts`, `robots.ts`, security headers in `next.config.ts`
- [ ] Sentry wired in both apps; UptimeRobot pinging `/health`
- [ ] Run the full **Going Live Checklist** in `docs/DEVELOPER-GUIDE.md`

**Exit criteria:** client signs off; DNS cutover scheduled.

---

## 5. Module dependency graph

```
                ┌── compatibility module ─┐
products/seed ──┤                         ├── compatibility wizard ─┐
                └── meilisearch sync ─────┘                          │
                                                                     ▼
                ┌── courier module ──────┐                       checkout
   addresses ───┤                        ├── shipping options ───┘  │
                └── postal code zones ───┘                           │
                                                                     ▼
                ┌── payfast provider ────┐                        order placed
   checkout ────┤                        ├── ITN webhooks ──────────┤
                └── ozow provider ───────┘                           │
                                                                     ▼
                                              order-placed subscriber ──► Resend (email)
                                                                          n8n  (social)
   b2b module ──► customer groups + price lists ──► auto-applied at checkout
   sanity     ──► revalidate webhook            ──► Next.js on-demand ISR
```

Anything on the right depends on everything on the left in the same row.
Don't start the right column before the left column has at least a
walking-skeleton implementation.

---

## 6. Open decisions (need client input before phase 4)

| # | Decision | Owner | Needed by |
|---|---|---|---|
| 1 | Which design POC do we promote? (`/one` / `/two` / `/three` / `/four`) | Client | End of Phase 0 |
| 2 | Domain registrar + DNS — is Cloudflare account ready? | Client | End of Phase 0 |
| 3 | PayFast and Ozow merchant accounts — sandbox creds in hand? | Client | Start of Phase 3 |
| 4 | Reseller / wholesale discount %s (currently assumed 15% / 25%) | Client | Start of Phase 4 |
| 5 | Final product CSV (SKU, title, price, stock, OEM flag, images) | Client | End of Phase 4 |
| 6 | Compatibility CSV (printer brand → model → SKU) | Client | End of Phase 2 |
| 7 | Courier accounts — Courier Guy and Aramex API creds | Client | Start of Phase 3 |
| 8 | Meta Business — Page + Instagram Business linked, app reviewed | Client | Start of Phase 5 |
| 9 | Resend sending domain — DKIM/SPF on `tseonline.co.za` | Client | Start of Phase 3 |

If any of these slip, the phase that depends on them slips with it. Do not
silently work around missing inputs — call them out in the weekly review.

---

## 7. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| PayFast ITN signature mismatch (field-order bugs) | High | Cannot accept payment | Test against PayFast sandbox vectors in Phase 3 day 1; isolate signature logic with unit tests |
| Meta App review rejected (`instagram_content_publish`) | Medium | No auto-posting at launch | Submit for review in Phase 4, not Phase 5 — review can take 5–10 business days |
| Courier API downtime at checkout | Medium | Customer cannot complete order | Flat-rate fallback table (`courier/rates.ts`) used when API errors |
| Supabase RLS misconfigured exposes B2B prices to public | Low | Reputational | Enable RLS on every table from migration day 1; add E2E test that anonymous users only see standard pricing |
| 60-day Meta token expiry forgotten | Medium | Auto-posting silently breaks | Cron in n8n that refreshes the long-lived token weekly + Sentry alert on failure |
| Product import CSV arrives malformed / late | High | Catalogue empty at launch | Build the importer in Phase 1 against synthetic data; client supplies CSV by end of Phase 4 |
| Performance regressions on product detail page | Medium | Bad CWV, hurts SEO | Lighthouse CI in Phase 5; ISR `revalidate: 3600` + on-demand revalidate via Medusa webhooks |

---

## 8. Kickoff checklist for Monday

Before we cut Phase 0 work into feature branches:

- [ ] Decide which design POC is the production direction (decision #1 above)
- [ ] Confirm `feature/setup` is merged or carried forward
- [ ] Verify all dev team have access to: GitHub repo, Supabase project, Vercel project, Railway project, Sanity project
- [ ] Provision local `.env` files from the agreed dev Supabase + dev Railway URLs
- [ ] Confirm `pnpm install && pnpm dev` works on every developer machine
- [ ] Establish daily 15-min standup window (SAST)
- [ ] WhatsApp group with client created (per retainer terms)

When every box is ticked, we're cleared to start Phase 1.
