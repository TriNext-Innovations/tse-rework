# TSE Online

Headless e-commerce platform for TSE Online — South Africa's printer cartridge supplier. Migrating from WooCommerce to a Medusa v2 + Next.js 15 monorepo, self-hosted on Vultr Johannesburg.

**Status:** 🟢 Live in production — [`tse-cartridges.co.za`](https://tse-cartridges.co.za) (Vultr JHB), running side by side with the legacy WooCommerce site (`tse.co.za`) since 2026-07-01. Remaining go-live gates tracked in [`docs/CLIENT-PENDING.md`](docs/CLIENT-PENDING.md).

---

## Tech stack

| Layer | Technology | Version |
|---|---|---|
| Storefront | Next.js (App Router) | 15 |
| Commerce backend | Medusa | v2 |
| Database | PostgreSQL | 16 |
| Cache / queues | Redis | 7 |
| Shared UI | shadcn/ui (new-york) + Tailwind CSS | 3.4 |
| Email | Resend | — |
| Payments | PayFast + Ozow | — |
| Shipping | The Courier Guy + Aramex | — |
| Reverse proxy | Nginx (Alpine) | — |
| CI/CD | GitHub Actions → SSH deploy | — |
| Hosting | Vultr JHB (4 GB main VM + 1 GB n8n VM) | — |

---

## Repository structure

```
tse-ui/
├── apps/
│   ├── web/              Next.js 15 storefront        (@tse/web)
│   └── backend/          Medusa v2 API + admin        (@tse/backend)
├── packages/
│   ├── ui/               Shared shadcn/ui components  (@tse/ui)
│   ├── config/           Tailwind / ESLint / TS base  (@tse/config)
│   └── types/            Shared TypeScript types      (@tse/types)
├── infrastructure/
│   └── nginx/            Nginx reverse proxy config
├── migration/            WooCommerce → Medusa scripts & audit data
├── docs/                 Architecture, data model, design tokens
├── docker-compose.yml    Full local stack
└── .github/workflows/    deploy.yml — push to main triggers SSH deploy
```

---

## Local development

### Prerequisites

- Node 20+, pnpm 9+
- Docker + Docker Compose

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env.local
# fill in apps/backend/.env — minimum: DATABASE_URL, REDIS_URL, JWT_SECRET, COOKIE_SECRET
```

The root `.env` already contains `POSTGRES_PASSWORD` for docker-compose. Edit it if you want a different password (and mirror it in `apps/backend/.env`).

You do **not** need object-storage credentials to work locally. If `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` are unset, the S3 file provider is not registered and the backend boots without it — everything works except uploading product images.

`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` is filled in at step 6 below, once the database exists.

### 3. Start the database and Redis

```bash
docker compose up postgres redis -d
```

This starts Postgres on `localhost:5432` and Redis on `localhost:6379` in the background. Everything else runs natively for hot-reload.

### 4. Run database migrations

```bash
pnpm --filter backend migrate
```

Only needed on first run and after pulling changes that add new migrations.

### 5. Start the Medusa backend

```bash
pnpm --filter backend dev
```

Medusa takes ~10–15 seconds to boot. Wait for:

```
✔ Server is ready on port: 9000
```

### 6. Copy the publishable API key into the storefront

The storefront authenticates every `/store` call with a publishable key. Without
it you get `Publishable API key required in the request header:
x-publishable-api-key` and a storefront with no products, no cart and no search.

Migrating the database creates a default key. Print it with:

```bash
pnpm --filter @tse/backend key
```

Copy the `pk_...` value into `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` in
`apps/web/.env.local`. (It is also in Medusa admin under
Settings → Publishable API keys.)

### 7. Start the Next.js storefront

In a second terminal:

```bash
pnpm --filter web dev
```

| URL | Service |
|---|---|
| http://localhost:3000 | Next.js storefront |
| http://localhost:9000 | Medusa API |
| http://localhost:9000/app | Medusa admin dashboard |
| http://localhost:9000/health | Medusa health check |

### Shut it all down

```bash
# Stop the dev servers with Ctrl+C in each terminal, then:
docker compose down
```

---

## Common commands

| Command | Description |
|---|---|
| `docker compose up postgres redis -d` | Start infra only (Postgres + Redis) |
| `pnpm --filter backend migrate` | Run pending DB migrations |
| `pnpm --filter @tse/backend key` | Print the publishable API key for the storefront |
| `pnpm --filter backend dev` | Start Medusa backend with hot reload |
| `pnpm --filter web dev` | Start Next.js storefront with hot reload |
| `pnpm build` | Build all workspaces |
| `pnpm lint` | Lint all workspaces |
| `pnpm type-check` | TypeScript checks across all workspaces |
| `docker compose up --build` | Full production-like stack via Docker |
| `pnpm --filter @tse/web exec shadcn add <component>` | Add a shadcn component |

---

## Branching strategy

| Branch | Purpose |
|---|---|
| `main` | Production — protected, requires 1 PR review |
| `develop` | Default branch — active development target |
| `feature/*` | Feature branches, PR into develop |
| `initial/Phase-0` | Phase 0 migration & scaffold work |

Features PR into `develop`; a rolling `develop → main` release PR batches them
and merging it deploys to production. See [docs/RELEASING.md](docs/RELEASING.md).

---

## Deployment

Push to `main` → `.github/workflows/deploy.yml` SSHes into the Vultr VM, runs `git pull` + `docker compose up --build -d`, health-checks Medusa and Next.js, rolls back on failure.

Required GitHub secrets: `VM_HOST`, `VM_USER`, `VM_SSH_KEY`, `VM_PORT` (optional, default 22).

---

## Phase 0 — What's done

### ✅ §1 WooCommerce Audit
- Product export (560 products), transform to variable/simple (340 total)
- Attribute, category, image, compatibility, plugin audits complete
- Customer/order export pending client POPIA consent

### ✅ §2 Compatibility Data (partial)
- 12 printer brands, 512 unique models extracted from product descriptions
- `migration/raw/compat-map-draft.csv` — 249 products mapped (73.2%)
- `migration/raw/compat-gaps.csv` — 91 products with no data, for client to fill
- Compatibility data model designed (`docs/data-model.md`)
- **Blocked:** SKU→model mapping (#2.4) needs client CSV validation

### ✅ §6 Monorepo Scaffold
- Next.js 15 + Medusa v2 workspaces initialised
- shadcn/ui (new-york), Tailwind v3, Inter + Fraunces fonts
- Component directory structure, barrel exports
- `.env.example` files for both apps

### ✅ §7 Design System
- Single-source-of-truth colour token system in `globals.css`
- `brand.*` Tailwind utilities + shadcn semantic token mapping
- Dark mode support
- Documented in `docs/design-tokens.md`
- **Blocked:** final brand colours pending client (#3.2)

### ✅ Infrastructure config (files written, not yet live)
- `docker-compose.yml` — all 5 services, memory limits, health checks
- `infrastructure/nginx/` — gzip, proxy headers, dev subdomains
- `.github/workflows/deploy.yml` — SSH deploy, health check, rollback

---

## Phase 0 — What's still open

### Blocked on Vultr VM provisioning (#4.1 — critical path)
- [ ] #4.1 Provision main VM (4 GB, Vultr JHB) ← **start here**
- [ ] #4.2 Provision n8n VM (1 GB, Vultr JHB)
- [ ] #4.3 Harden both VMs
- [ ] #4.4 Install Docker + Docker Compose
- [ ] #4.5 Configure 4 GB swap on main VM
- [ ] #4.6 Set up Cloudflare + transfer DNS
- [ ] #4.7 Create dev.tse.co.za subdomain
- [ ] #4.8 Configure Cloudflare SSL/TLS (Full Strict)
- [ ] #4.10 Configure GitHub Actions deployment secrets
- [ ] #6.2 Initialise Medusa v2 backend (verify on server)
- [ ] #6.8 Confirm skeleton running on dev URL

### Blocked on client (#3 Client Assets — critical path for design)
- [ ] #3.1 Obtain logo in SVG format
- [ ] #3.2 Obtain brand colour codes ← needed to finalise design tokens
- [ ] #3.3 Confirm typography
- [ ] #3.4 Collect product photography
- [ ] #3.5 Create favicon & app icons (TriNext, after #3.1)
- [ ] #3.6 Request existing brand guidelines

### Blocked on client (#5 Third-Party Credentials)
- [ ] #5.1 PayFast merchant credentials ← critical path
- [ ] #5.2 Ozow credentials
- [ ] #5.3 Meta Business access

### Blocked on client decision
- [ ] #1.6 Export customer data (POPIA written consent required first)
- [ ] #1.7 Export order history (client to decide scope)
- [ ] #2.4 Map cartridge SKUs to printer models (client to fill compat-gaps.csv)

### Pending client CSV return (#2.4)
- [ ] #2.5 Document compatibility data gaps (follows from #2.4)
- [ ] #2.3 Finalise printer model list (client review)
- [ ] #2.2 Confirm printer brand list (client review)

### Joint / governance
- [ ] #5.4 Resend transactional email setup
- [ ] #5.6 Aramex shipping API registration
- [ ] #5.7 The Courier Guy API registration
- [ ] #8.1 Confirm client communication channel
- [ ] #8.2 Confirm asset delivery deadline in writing
- [ ] #8.3 Schedule Milestone 1 kickoff call
- [ ] #8.4 Set up shared project tracker
- [ ] #8.5 Confirm PayFast sandbox access before Milestone 2

---

## Docs

| Document | Contents |
|---|---|
| [docs/data-model.md](docs/data-model.md) | PostgreSQL compatibility schema (printer_brand → printer_model → cartridge_compatibility) |
| [docs/design-tokens.md](docs/design-tokens.md) | Brand tokens, Tailwind utilities, shadcn mapping, typography |
| [docs/Architecture.md](docs/Architecture.md) | System architecture, data flow, infrastructure |
| [docs/DEVELOPER-GUIDE.md](docs/DEVELOPER-GUIDE.md) | Git workflow, testing, migrations |
| [docs/BUILD-PLAN.md](docs/BUILD-PLAN.md) | Milestone breakdown and delivery plan |

---

## Commit convention

```
feat:      new feature
fix:       bug fix
chore:     tooling, deps, config
docs:      documentation only
refactor:  no behaviour change
test:      tests
```
