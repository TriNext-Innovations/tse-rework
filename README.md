# TSE Online

South Africa's trusted printer cartridge e-commerce platform — migrating from WooCommerce to a Medusa v2 + Next.js 15 monorepo.

## Tech Stack

| Layer | Technology | Hosted On |
|---|---|---|
| Storefront | Next.js 15 (App Router) | Vultr JHB (Docker) |
| Commerce backend | Medusa v2 | Vultr JHB (Docker) |
| Database | PostgreSQL 16 | Vultr JHB (Docker volume) |
| Cache / queues | Redis 7 | Vultr JHB (Docker volume) |
| CMS | Sanity Studio v3 | sanity.io hosting |
| Email | Resend | resend.com |
| Payments | PayFast + Ozow | External |
| Shipping | The Courier Guy + Aramex | External |
| Reverse proxy | Nginx (Alpine) | Vultr JHB (Docker) |
| Automation | n8n | Vultr JHB n8n VM |

## Prerequisites

- Node 20+
- pnpm 9+
- Docker + Docker Compose (for local full-stack run)

## Local development

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example     apps/web/.env.local
cp apps/studio/.env.example  apps/studio/.env.local
# Fill in secrets — see each .env.example for documentation
```

### 3. Start with Docker Compose (recommended)

```bash
docker compose up --build
```

- `http://localhost:3000` — Next.js storefront
- `http://localhost:9000` — Medusa backend + admin (`/app`)
- `http://localhost:9000/health` — Medusa health check

### 4. Or start apps individually (no Docker)

Requires local PostgreSQL and Redis.

```bash
pnpm dev
```

## Repository structure

```
tse-ui/
├── apps/
│   ├── web/          # Next.js 15 storefront (@tse/web)
│   ├── backend/      # Medusa v2 backend (@tse/backend)
│   └── studio/       # Sanity Studio v3 (@tse/studio)
├── packages/
│   ├── ui/           # Shared shadcn/ui components (@tse/ui)
│   ├── config/       # Tailwind, ESLint, TS configs (@tse/config)
│   └── types/        # Shared TypeScript interfaces (@tse/types)
├── infrastructure/
│   └── nginx/        # Nginx reverse proxy config
├── migration/        # WooCommerce → Medusa migration scripts & data
├── docs/             # Architecture, data model, design tokens
└── .github/
    └── workflows/    # CI/CD — deploy.yml triggers on push to main
```

## Common commands

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all apps and packages |
| `pnpm lint` | Lint all workspaces |
| `pnpm type-check` | TypeScript checks across all workspaces |
| `docker compose up --build` | Full local stack via Docker |

### Add a shadcn/ui component

```bash
pnpm --filter @tse/web exec shadcn add button
```

## Branching strategy

| Branch | Purpose |
|---|---|
| `main` | Production — protected, requires PR review |
| `develop` | Default — active development target |
| `feature/*` | Feature branches, PRs into develop |
| `initial/Phase-0` | Phase 0 migration & scaffold work |

## Deployment

Push to `main` triggers `.github/workflows/deploy.yml` — SSH deploy to the Vultr JHB VM, rebuilds Docker containers, health-checks Medusa and Next.js, rolls back on failure.

See `docs/Architecture.md` for full infrastructure details.

## Commit convention

```
feat:     new feature
fix:      bug fix
chore:    tooling, deps, config
docs:     documentation only
refactor: no behaviour change
test:     test additions/changes
```
