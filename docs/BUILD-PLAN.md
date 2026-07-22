# TSE Online — Build Plan & Architecture Scope

> **Historical planning document — reconciled 2026-07-22.** The site went
> live 2026-07-01 and the build described below is largely complete, on
> infrastructure that diverged from what's planned here in specific,
> confirmed ways: **no Coolify** (plain Docker Compose + GitHub Actions SSH
> deploy instead), **no Supabase** (self-hosted Postgres on the same VM —
> which also means the whole §10 POPIA cross-border analysis was written
> against a DB hosting assumption that no longer holds and needs a real
> compliance re-review, not a doc patch), **email is ZeptoMail, not
> Resend**, **no Sanity CMS** (never integrated), **n8n runs on separate
> infrastructure** the client set up themselves — not the dedicated Vultr
> VM this document describes.
>
> Every section below that mentions Coolify, Supabase, Resend, Sanity, a
> dedicated n8n VM, or the `tseonline.co.za` domain (§3, §4, §7, §8, §10,
> §11 all have instances) is describing **the original plan, not what was
> built**. This document is kept as a real record of what was decided and
> why at the time — it was not rewritten line-by-line to match reality,
> only flagged. For current infrastructure, use `docs/Architecture.md`,
> `docs/PROD-DEPLOY.md`, and `README.md`.

Companion to `docs/Architecture.md`. That document describes the **target system**;
this one describes the **path to get there** — what is already in place, what
is missing, and the order in which we will build it during the upcoming
implementation phase.

- **Project start:** April 2026
- **Go-live target:** June 2026 — **actual go-live: 2026-07-01**
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

- **Framework versions are behind current stable** — see section 9
- **POPIA hosting strategy is undecided** — see section 10
- No real Medusa modules — `compatibility/`, `b2b/`, `courier/`, `payfast/`, `ozow/` all need to be created
- No subscribers (`order-placed`, `product-updated`, `search-sync`)
- No workflows (`create-quote`, `bulk-order`)
- No storefront commerce surfaces — `products/`, `products/[handle]/`, `cart/`, `checkout/`, `account/*`, `compatibility/`, `b2b/*` are not yet built
- No payment flows wired up (PayFast ITN, Ozow webhook)
- No transactional emails (Resend + React Email templates)
- No search (Meilisearch index + sync + UI)
- No POPIA layer (cookie banner, privacy/cookies pages, data-requests endpoint)
- No courier integration (Courier Guy / Aramex)
- No admin extensions (compatibility widget, B2B tier widget, social posts widget, quotes route)
- No tests (Vitest unit, Playwright E2E)
- No `docker-compose.yml` despite the dev guide referencing it
- No CI (lint / type-check / test on PRs)

---

## 3. Target architecture

> **Superseded — see the banner at the top of this file.** The diagram
> below was the plan; it is not what actually got built. No Coolify, no
> Supabase, no Sanity, and n8n is external infra, not a service on this VM.

### Chosen infrastructure stack (as originally planned — not built this way)

```
Browser
   │
   ▼
Cloudflare Free  (DNS + CDN + DDoS + SSL at edge — JHB PoP)
   │
   ▼
Vultr JHB VPS — 2 vCPU / 4 GB RAM / 80 GB SSD  (~R440/mo)
   │  Coolify manages all services below via Docker
   ├── Next.js 16  (output: standalone, port 3000)
   ├── Medusa v2   (port 9000)
   ├── Redis       (port 6379, internal only)
   ├── Meilisearch (port 7700, internal only)  ← Phase 2
   └── n8n         (port 5678, internal only)  ← Phase 5
          │
          ▼
   PostgreSQL 16   (Docker container, named volume — Vultr main VM)
   Vultr Object Storage  (product images — S3-compatible, JHB1)
   Resend Free     (transactional email — 3K/mo)
   Cloudflare R2   (media backup storage — 10 GB free)

   PayFast / Ozow  (payment processors — SA-hosted, external)
   Meta Graph API  (Instagram/Facebook — external)
   Anthropic API   (caption generation — external, pay-per-use)
```

**All compute runs inside South Africa (Vultr JHB).** Only the Supabase
database is cross-border (US/EU) — mitigated via POPIA s.72 consent at
signup + signed DPA. See section 10 and 11 for full detail.

For full data flow, env vars, and DB schema extensions see `docs/Architecture.md`.

---

## 4. Phased build (six weeks)

The phases are sequenced so each one unblocks the next. Each phase ends with
something demonstrable to the client.

### Phase 0 — Foundations (this week, on `feature/setup`)

Goal: a developer can clone the repo and have `pnpm dev` boot a working
Medusa + Next.js + Postgres stack within ten minutes — on the **locked-in
framework versions** (see section 9) and the **chosen infra** (see section 11).

**Infra provisioning (do this first — everything else gates on it):**
- [ ] Provision **Vultr JHB VPS** (2 vCPU / 4 GB / 80 GB SSD)
- [ ] Install **Coolify** on the VPS (`curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`)
- [ ] Point `tseonline.co.za` and `api.tseonline.co.za` DNS to VPS IP via **Cloudflare** (proxied, orange cloud)
- [ ] Set Cloudflare SSL/TLS mode to **Full (Strict)**; issue origin cert via Cloudflare or Let's Encrypt
- [ ] Lock VPS firewall to accept HTTP/HTTPS only from **Cloudflare IP ranges** (block direct access to VPS IP)
- [ ] Create **Supabase free project**; copy `DATABASE_URL` into Coolify env vars for Medusa
- [ ] Add Coolify services: **Next.js**, **Medusa**, **Redis** — leave Meilisearch and n8n for Phase 2/5
- [ ] Confirm git-push deploy works end-to-end (push → Coolify builds → live)

**Framework upgrades (see section 9 for full order):**
- [ ] Next.js 15 → 16, React 18 → 19, Tailwind 3 → 4, shadcn/ui init on v4, Medusa pin to 2.14.1, TypeScript ≥5.7

**Repo setup:**
- [ ] Add `docker-compose.yml` for **local dev** (Postgres, Redis) — Coolify handles production
- [ ] Wire `apps/backend` so `medusa develop` starts locally (currently `modules: []`)
- [ ] Pick the production design POC and promote its layout into a real `(storefront)/layout.tsx`
- [ ] Move `/one`–`/four` POC routes under `apps/web/src/app/poc/`
- [ ] Add CI workflow: `lint`, `type-check`, `build` on every PR
- [ ] Add Husky + lint-staged + Conventional Commits enforcement

**Exit criteria:** git push deploys successfully to Vultr via Coolify, Medusa
API responds at `api.tseonline.co.za/health`, design direction locked.

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

### Phase 4 — B2B & accounts (week 5)

Maps to AI prompts 5 and 11.

- [ ] `modules/b2b/` with `pricing_tier` + auto-applied price lists
- [ ] `(storefront)/account/*` (orders, addresses, password reset)
- [ ] `(storefront)/b2b/login`, `b2b/dashboard`, `b2b/quote`
- [ ] `quote_request` table + `POST /store/b2b/quote` + admin email via Resend
- [ ] Admin widgets: compatibility, B2B tier, social posts, quotes route

**Exit criteria:** client can log in as a reseller and see reseller pricing.

### Phase 5 — Automation, POPIA & launch hardening (week 6)

Maps to AI prompts 6, 9, 10, 12.

**Status as of 2026-07-22:** POPIA/hardening items below shipped (with
substitutions — Bugsink instead of Sentry, self-hosted instead of
Supabase). The n8n/social-posting items were **not** built as part of this
repo's work — n8n exists now, but on separate infrastructure the client
set up independently, not via a `product-updated`/`cart-abandoned`
subscriber calling it. If that automation gets built, it needs designing
fresh against how n8n is actually reachable (Medusa's public Admin API,
not an internal Docker route) — treat the two n8n line items below as
not-started, not done-differently.

- [ ] n8n workflow `social-posting-workflow.json` (Anthropic caption + Meta Graph) — not built
- [ ] `subscribers/product-updated.ts` triggers n8n on create/restock — not built (no such subscriber exists)
- [ ] `subscribers/cart-abandoned.ts` triggers n8n WhatsApp recovery — not built
- [ ] `social_posts` Supabase table + admin "Post Now" button — not built; also would need to be a self-hosted-Postgres table now, not Supabase
- [x] POPIA: `CookieBanner`, `legal/privacy`, `legal/cookies`, `/store/data-requests` endpoint — shipped
- [x] `sitemap.ts`, `robots.ts` — shipped (sitemap pagination fixed 2026-07-22, see PR #334); security headers in `next.config.ts` unconfirmed, check directly
- [x] Error tracking wired in both apps — **Bugsink (self-hosted), not Sentry**; UptimeRobot status unconfirmed
- [ ] Run the full **Going Live Checklist** in `docs/DEVELOPER-GUIDE.md` — unconfirmed whether this ever happened as written

**Exit criteria:** client signs off; new site goes live at `tse-cartridges.co.za` **side by side** with the existing WooCommerce site (`tse.co.za`). No hard cutover — both run in parallel; decommissioning the old site is a separate, later step once the new one is proven in production.

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
| 14 | **SKU master list — BLOCKER.** WC audit (2026-05-14) found all 560 products have no SKU. Medusa seed and compatibility finder both gate on this. Provide supplier SKU CSV or add SKUs in WooCommerce before Phase 1 seed. See `migration/MIGRATION-LOG.md`. | Client | Before Phase 1 seed |
| 7 | Courier accounts — Courier Guy and Aramex API creds | Client | Start of Phase 3 |
| 8 | Meta Business — Page + Instagram Business linked, app reviewed | Client | Start of Phase 5 |
| 9 | Resend sending domain — DKIM/SPF on `tseonline.co.za` | Client | Start of Phase 3 |
| 10 | ~~POPIA hosting strategy~~ **✅ DECIDED:** Vultr JHB for all compute (SA-hosted); Supabase Free for DB (cross-border, mitigated via s.72 consent + DPA — see section 10) | — | Closed |
| 11 | ~~Approve Phase 0 framework upgrades~~ **✅ DECIDED:** Next 16, React 19, Tailwind 4 — see section 9 | — | Closed |
| 12 | Information Officer named and registered with the Information Regulator | Client | Before launch |
| 13 | DPAs signed with **Supabase, Resend, Meta, Anthropic, Cloudflare** (Vercel/Railway no longer used) | Client + Dev | Before launch |

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
| POPIA — Supabase DB is cross-border (US/EU) | Low–Medium | Information Regulator notice | Mitigated: all compute is SA-hosted (Vultr JHB); DB cross-border covered by s.72(1)(b) consent checkbox at signup + signed Supabase DPA + privacy policy disclosure. Upgrade to RDS `af-south-1` when revenue supports it. |
| Single VPS = single point of failure | Medium | Downtime during hardware event | Vultr SLA + UptimeRobot alerts; Coolify auto-restarts crashed containers; Supabase DB is separate (survives VPS failure). Upgrade to 2-VPS setup when traffic justifies it. |
| Framework upgrade regressions (Next 15→16, React 18→19, Tailwind 3→4) | Medium | Build delays | Do all upgrades together in Phase 0 before any feature work — never ship features on outdated versions and upgrade later (doubles the work) |
| 60-day Meta token expiry forgotten | Medium | Auto-posting silently breaks | Cron in n8n that refreshes the long-lived token weekly + Sentry alert on failure |
| Product import CSV arrives malformed / late | High | Catalogue empty at launch | Build the importer in Phase 1 against synthetic data; client supplies CSV by end of Phase 4 |
| Performance regressions on product detail page | Medium | Bad CWV, hurts SEO | Lighthouse CI in Phase 5; ISR `revalidate: 3600` + on-demand revalidate via Medusa webhooks |

---

## 8. Kickoff checklist for Monday

Before we cut Phase 0 work into feature branches:

**Infrastructure (dev team action):**
- [ ] Provision Vultr JHB 4 GB VPS and install Coolify
- [ ] Create Supabase free project; save `DATABASE_URL`
- [ ] Configure Cloudflare DNS (proxied) + Full (Strict) SSL
- [ ] Confirm Medusa API responds at `api.tseonline.co.za/health`

**Client sign-offs:**
- [ ] Decide which design POC is the production direction (decision #1)
- [ ] Confirm Cloudflare account and domain access is ready (decision #2)
- [ ] WhatsApp group created with client

**Dev team setup:**
- [ ] Confirm `feature/setup` is merged or carried forward
- [ ] All dev team have access to: GitHub repo, Vultr console, Cloudflare account
- [ ] Provision local `.env` files (copy from `.env.example`, start local Docker stack)
- [ ] Confirm `pnpm install && pnpm dev` works on every developer machine (local Docker for Postgres + Redis)
- [ ] Establish daily 15-min standup window (SAST)

When every box is ticked, we're cleared to start Phase 1.

---

## 9. Framework versions & upgrade path

As of April 2026, the scaffolded `package.json` files are behind current
stable releases. Phase 0 includes a coordinated upgrade so we don't build
features against soon-to-be-legacy versions.

| Package | In `package.json` | Current stable (Apr 2026) | Notes |
|---|---|---|---|
| `next` | `15.2.8` | **16.2** (released Mar 2026) | Major bump. Requires React 19. Brings Turbopack stable, Adapter API, Server Fast Refresh, AI-aware `create-next-app`. Codemods available via `npx @next/codemod@latest`. |
| `react` / `react-dom` | `^18.3.1` | **19.x** | Required by Next 16 **and** by shadcn/ui on Tailwind v4. `useOptimistic`, `useFormStatus`, Server Components are stable. |
| `tailwindcss` | `^3.4.3` | **4.x** (GA early 2025) | CSS-first config via `@theme` block — `tailwind.config.ts` is replaced by directives in `globals.css`. New Oxide engine = much faster builds. `tailwindcss-animate` deprecated → `tw-animate-css`. HSL → OKLCH for colors. |
| `shadcn/ui` | not installed yet | latest (Tailwind v4 + React 19 baseline) | Every primitive now has a `data-slot` attribute. Initialise on v4 from day one — do not ship v3 first. |
| `@medusajs/medusa` / `framework` | `^2.13.6` | **2.14.1** | Caret already accepts 2.14.x. Pin once stable. 2.14.0 brings Zod v4; recent MikroORM security patch. |
| Node | `>=20.0.0` engine | 20 LTS still supported; 22 LTS available | 20 fine through 2026. |
| `pnpm` | `9.0.0` | 9.x → 10.x available | 9 is fine for now. |
| `turbo` | `^2.0.0` | 2.x | Caret accepts current minor. |
| `typescript` | `^5.4.5` | 5.7+ | Bump to ≥5.7 to pick up `--strictBuiltinIteratorReturn` and stricter narrowing. |

**Phase 0 upgrade order** (do this exactly once, on `feature/setup`, before
any feature work):

1. Bump Node engine (if needed) and pnpm.
2. Upgrade React 18 → 19 across `apps/web`.
3. Upgrade Next.js 15 → 16; run `npx @next/codemod@latest` and fix any
   manual breakages (most are cookies/headers async APIs).
4. Upgrade Tailwind 3 → 4: convert `tailwind.config.ts` → `@theme` block in
   `apps/web/src/app/globals.css` and `packages/config/tailwind.config.ts` →
   `packages/config/theme.css`. Replace `tailwindcss-animate` with
   `tw-animate-css`.
5. Initialise shadcn/ui CLI against the v4 + React 19 baseline; generate
   the components listed in Phase 1 directly into `packages/ui`.
6. Pin `@medusajs/medusa` and `@medusajs/framework` to exact `2.14.1`; run
   any v2.13 → v2.14 migrations against the dev DB.
7. Bump TypeScript to ≥5.7; address any new strictness errors.
8. Verify CI green.

**We do not** start the design system, the catalogue, or any commerce
surface on the older versions. Upgrading later compounds the change set
and doubles the regression surface.

---

## 10. POPIA & data residency — architectural decision

POPIA Section 72 forbids transfer of personal information out of South
Africa unless one of these grounds applies:

1. The recipient country / processor is bound by laws, BCRs, or a binding
   agreement providing **adequate** protection substantially similar to POPIA.
2. The data subject has **consented** to the transfer.
3. The transfer is **necessary for performance of a contract** with the data subject.
4. The transfer is **for the benefit** of the data subject and consent isn't reasonably possible.

The Information Regulator can fine non-compliant operators. The May 2024
National Data and Cloud Policy further tightens localisation, especially
for government data — but for commercial e-commerce the consent /
contract grounds remain workable.

### 10.1 Where TSE Online's PII actually goes (chosen stack)

| Service | Holds personal info? | Region | POPIA status |
|---|---|---|---|
| **Vultr JHB** PostgreSQL (Docker) | Yes — customers, addresses, orders, B2B accounts | ✅ Johannesburg | ✅ SA-hosted, no s.72 trigger |
| **Vultr JHB** Next.js + Medusa | Compute only — no persistence | ✅ Johannesburg | ✅ SA-hosted, no s.72 trigger |
| Vultr Object Storage (JHB1) | No — product images only | ✅ Johannesburg | ✅ No PII |
| Resend Free | Yes — email address + email body | US/EU | ✅ s.72(1)(c) necessary for contract + DPA |
| Meilisearch (Vultr JHB) | No — products only | ✅ Johannesburg | ✅ No PII |
| PayFast / Ozow | Card data — handled entirely by them | South Africa | ✅ Not our processor |
| Cloudflare | In-flight only, no persistence | JHB PoP | ✅ Transit only |

All personal data stays in South Africa (Vultr JHB). Only Resend is cross-border,
mitigated via s.72(1)(c) (necessary for contract performance) + signed DPA.

### 10.2 ✅ Decision — Option A (chosen)

**Vultr JHB for all compute + Supabase Free for DB + s.72 consent at signup.**

All compute (Next.js rendering, Medusa API processing, n8n workflows) runs
in Johannesburg — no s.72 trigger for processing. The database crosses
borders but is covered by:
- Explicit granular consent checkbox at signup (not buried in T&Cs)
- Signed Supabase DPA (available on request from Supabase)
- Privacy Policy disclosing Supabase and its US/EU hosting region

**Upgrade trigger:** when monthly revenue exceeds ~R15,000, migrate DB to
RDS Postgres `af-south-1` (~R450/mo). The migration is a single
`DATABASE_URL` swap — no application code changes.

### 10.3 What we owe POPIA regardless of hosting

These are required even if we pick Option B (local hosting) — they are
about *processing*, not just *location*:

- Privacy Policy disclosing every third-party processor and its hosting region.
- Cookie banner with granular consent (Necessary / Analytics / Marketing).
- Explicit "I consent to processing of my personal information, including
  cross-border transfer to [list]" checkbox at signup if Option A.
- `data_requests` table and `/store/data-requests` endpoint for access /
  correction / deletion (Phase 5).
- 36-hour breach notification process — Information Regulator + affected subjects.
- Information Officer named and registered with the Information Regulator
  (this is the client's MD by default — confirm and register before launch).
- Signed DPAs with Supabase, Resend, Meta, Anthropic, Cloudflare before go-live (decision #13).
- Retention schedule documented — orders kept 5 years (tax/SARS), marketing
  consent re-confirmed annually, abandoned-cart data purged after 90 days.

Sources used to verify the above:

- [Next.js 16 release notes](https://nextjs.org/blog/next-16) and [16.1](https://nextjs.org/blog/next-16-1)
- [Medusa releases on GitHub](https://github.com/medusajs/medusa/releases)
- [shadcn/ui on Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4)
- [Supabase available regions](https://supabase.com/docs/guides/platform/regions) and [SA region request thread](https://github.com/orgs/supabase/discussions/34614)
- [Michalsons: cross-border transfers under POPIA](https://www.michalsons.com/blog/guidance-note-on-cross-border-transfers-to-from-south-africa/77246)
- [VDT Attorneys: cloud regulation and POPIA](https://vdt.co.za/data-protection/south-africa-cloud-regulation-and-popia-what-remote-computing-services-need-to-know/)
- [AWS South Africa data privacy](https://aws.amazon.com/compliance/south-africa-data-privacy/)

---

## 11. Infrastructure costs

> **Not re-verified.** These are the original launch estimates. Actual
> current spend wasn't checked as part of this pass — the cost basis has
> since changed (no Coolify, no Supabase, Bugsink added, n8n is a
> separate bill not reflected here at all since it runs outside this
> plan's infrastructure). Don't quote these numbers as current without
> checking actual invoices/billing first.

### 11.1 Monthly recurring

| Service | Plan | Cost (ZAR) | Notes |
|---|---|---|---|
| **Vultr Cloud Compute JHB** | 2 vCPU / 4 GB / 80 GB SSD | **~R440** | The only real bill. Hosts everything. |
| Vultr automated backups | 20% of VPS | ~R88 | Recommended. Or DIY to Cloudflare R2 (free). |
| **Total recurring** | | **~R440–528** | |

### 11.2 Free-tier services (R0/mo at launch)

| Service | What it provides | Free limit | Notes |
|---|---|---|---|
| Cloudflare Free | DNS, CDN, DDoS, SSL at JHB edge | Unlimited bandwidth | Free forever |
| Resend Free | Transactional email | 3,000/mo, 100/day | Free forever at this volume |
| UptimeRobot Free | Uptime monitoring, 5-min checks | 50 monitors | Free forever |

### 11.3 Variable / usage-based

| Item | Model | Est. at launch |
|---|---|---|
| Anthropic API | Per token | ~R30–80/mo at low post volume |
| PayFast | 3.5% + R2 per transaction | Only charged on real sales |
| Ozow | ~1.5% per transaction | Only charged on real sales |
| WhatsApp Business | Free first 1,000 conversations/mo | R0 at startup |
| Courier Guy / Aramex | Per shipment | Only on real shipments |

### 11.4 Annual

| Item | Cost | Notes |
|---|---|---|
| `.co.za` domain | ~R100/yr (~R9/mo amortised) | Client likely owns already |

### 11.5 All-in launch cost

```
Vultr 4 GB JHB VPS         R440/mo
Vultr automated backups     R88/mo   (optional)
Domain (amortised)          R9/mo
Anthropic API               ~R50/mo  (rough average)
─────────────────────────────────────
TOTAL                       ~R587/mo
Without backups option      ~R499/mo
```

### 11.6 Comparison to original plan

| Stack | Monthly | Annual | POPIA compute |
|---|---|---|---|
| Vultr JHB + Coolify *(chosen)* | **~R500** | **~R6,000** | ✅ SA-hosted |
| Vercel Pro + Railway + Supabase | ~R1,300 | ~R15,600 | ❌ All cross-border |
| All-AWS `af-south-1` | ~R3,500–5,000 | ~R42,000–60,000 | ✅ SA-hosted |

**Annual saving vs Vercel + Railway route: ~R9,600/year.**

### 11.7 Growth-triggered upgrades

| Trigger | Upgrade | Cost delta |
|---|---|---|
| Supabase free DB fills up (500 MB) | Move to RDS Postgres `af-south-1` | +~R450/mo |
| VPS memory consistently >75% | Resize Vultr → 8 GB plan | +~R440/mo (440 → 880) |
| Media storage > 1 GB | Cloudflare R2 paid tier | +~R10/mo per 10 GB |
| >100 orders/mo | Add Redis persistence + upgrade Railway workers → already on Coolify, just resize | +R0 (already on VPS) |
| >5,000 visits/mo | Add 2nd Vultr VPS, split app + DB tiers | +~R440/mo |

None of these trigger at launch. Re-evaluate at 6-month mark.
