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

- **Framework versions are behind current stable** — see section 9
- **POPIA hosting strategy is undecided** — see section 10
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
Medusa + Next.js + Postgres + Meilisearch stack within ten minutes — on the
**locked-in framework versions** (see section 9).

- [ ] **Framework upgrade pass** (see section 9 for the full upgrade order):
      Next.js 15 → 16, React 18 → 19, Tailwind 3 → 4, Medusa pin to 2.14.1,
      shadcn/ui initialised on the v4 baseline
- [ ] **POPIA hosting decision locked** with the client (see section 10) — this
      gates which `DATABASE_URL` we wire up
- [ ] Add `docker-compose.yml` for local Postgres, Redis, Meilisearch, n8n
- [ ] Wire `apps/backend` so `medusa develop` actually starts (currently `modules: []` and no `src/` entrypoint files beyond config)
- [ ] Pick the production design POC and promote its layout into a real
      `(storefront)/layout.tsx` with header/footer placeholders
- [ ] Move `/one`–`/four` POC routes under `apps/web/src/app/poc/` so the
      storefront root is free for the real homepage
- [ ] Add CI workflow: `lint`, `type-check`, `build` on every PR
- [ ] Add Husky + lint-staged + Conventional Commits enforcement
- [ ] Confirm Supabase project is provisioned and `DATABASE_URL` works

**Exit criteria:** green CI on the upgraded stack, fresh clone boots
end-to-end, design direction locked, POPIA hosting option chosen.

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
| 10 | **POPIA hosting strategy** — Option A / B / C / D / E (see section 10) | Client + Dev | End of Phase 0 |
| 11 | Approve Phase 0 framework upgrades (Next 16, React 19, Tailwind 4) | Client | End of Phase 0 |
| 12 | Information Officer named and registered with the Information Regulator | Client | Before launch |
| 13 | DPAs signed with Supabase, Resend, Meta, Anthropic, Cloudflare | Client + Dev | Before launch |

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
| **POPIA cross-border transfer non-compliance (Supabase Cloud has no SA region)** | High if ignored | Information Regulator fine, reputational | Decision required in Phase 0 — see section 10 for the five options. Default recommendation: stay on Supabase + explicit consent at signup + signed DPA + privacy disclosures (POPIA s.72(1)(b)). |
| Framework upgrade regressions (Next 15→16, React 18→19, Tailwind 3→4) | Medium | Build delays | Do all upgrades together in Phase 0 before any feature work — never ship features on outdated versions and upgrade later (doubles the work) |
| 60-day Meta token expiry forgotten | Medium | Auto-posting silently breaks | Cron in n8n that refreshes the long-lived token weekly + Sentry alert on failure |
| Product import CSV arrives malformed / late | High | Catalogue empty at launch | Build the importer in Phase 1 against synthetic data; client supplies CSV by end of Phase 4 |
| Performance regressions on product detail page | Medium | Bad CWV, hurts SEO | Lighthouse CI in Phase 5; ISR `revalidate: 3600` + on-demand revalidate via Medusa webhooks |

---

## 8. Kickoff checklist for Monday

Before we cut Phase 0 work into feature branches:

- [ ] Decide which design POC is the production direction (decision #1 above)
- [ ] Decide POPIA hosting option A/B/C/D/E (decision #10, section 10)
- [ ] Sign off on the Phase 0 framework upgrade plan (decision #11, section 9)
- [ ] Confirm `feature/setup` is merged or carried forward
- [ ] Verify all dev team have access to: GitHub repo, Supabase project, Vercel project, Railway project, Sanity project
- [ ] Provision local `.env` files from the agreed dev Supabase + dev Railway URLs
- [ ] Confirm `pnpm install && pnpm dev` works on every developer machine
- [ ] Establish daily 15-min standup window (SAST)
- [ ] WhatsApp group with client created (per retainer terms)

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

### 10.1 Where TSE Online's PII actually goes

| Service | Holds personal info? | Region today |
|---|---|---|
| **Supabase Cloud** (Postgres) | Yes — customers, addresses, orders, B2B accounts, quote requests | **No `af-south-1` region.** AWS US/EU only. |
| Resend | Yes — recipient email + email body | US/EU |
| Meilisearch (Railway) | No — products only | US/EU |
| n8n (Railway) | Sometimes — workflows touching customer email/address | US/EU |
| Sanity | No — marketing content only | Global CDN |
| PayFast / Ozow | They handle card data themselves; we never touch it | South Africa |
| Vercel | In-flight only (RSC, ISR caches) | Global Edge |
| Cloudflare | In-flight only | Has a JHB PoP |

The compliance gap is concentrated at **Supabase**. Supabase has
publicly declined (as of April 2026) to add an `af-south-1` region on
Cloud, despite repeated community requests.

### 10.2 The five options

| Option | Hosting for PII | POPIA basis | Pros | Cons |
|---|---|---|---|---|
| **A. Supabase Cloud + consent + DPA** *(default recommendation)* | AWS US/EU | s.72(1)(b) consent + s.72(1)(a) binding agreement | Zero infra change. Supabase publishes a POPIA-aligned DPA on request. Standard pattern for SA SaaS. | Consent must be **explicit and granular** at signup — not buried in T&Cs. Locks us in if client later demands local-only. |
| **B. Self-host Supabase on AWS `af-south-1`** | Cape Town | Local hosting, no s.72 trigger | Strongest POPIA story. Same Supabase API surface. Sub-30ms latency for SA customers. | We become the DBA team — backups, upgrades, RLS, replicas, security patches are now ours. ~R3,000–5,000/mo extra infra plus retainer hours. |
| **C. Managed Postgres in `af-south-1` (RDS / Neon)** | Cape Town | Local hosting | Local hosting without operating Supabase ourselves. RDS has POPIA-aligned addendum. | Lose Supabase Storage / Auth / Realtime — we'd rebuild those (S3 + Medusa auth + websockets or skip). Adds ~1–2 weeks to build. |
| **D. Hybrid: PII on `af-south-1` RDS, non-PII on Supabase** | Split | Local for PII | PII never crosses borders. | Two databases to operate. More complex backups and joins. Worth it only if RDS is mandatory but we want Supabase Storage for product images. |
| **E. Supabase Cloud + pseudonymise PII at app layer** | US/EU | Tokenisation | Keeps cloud convenience. | Fragile. Tokenised PII is **still PII** under POPIA — this is not a real exemption, only a defence-in-depth measure. Don't rely on this alone. |

### 10.3 Recommendation

**Option A for v1**, with Option B or C as a documented upgrade path if the
client's risk tolerance changes post-launch.

Why: SA-based fintech and e-commerce operators routinely run on AWS / GCP
regions outside ZA under POPIA s.72(1)(b) — explicit signup consent plus a
processor DPA. AWS publishes a POPIA-aligned addendum; Supabase signs a
DPA on request. Going Option B/C costs us 1–2 weeks and a recurring
operational burden that the retainer scope doesn't cover today. The
migration path from A → B/C is contained to the data layer (Medusa keeps
the same connection string).

The client gets the call. We surface it as decision #10 at Monday kickoff
and walk them through the trade-offs.

### 10.4 What we owe POPIA regardless of the option

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
- Signed DPAs with Supabase, Resend, Meta, Anthropic, Cloudflare, Vercel,
  Railway before go-live (decision #13).
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
