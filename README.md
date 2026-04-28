# TSE Online

South Africa's trusted printer cartridge e-commerce platform.

## Tech Stack

| Layer              | Technology              | Hosted On      |
|--------------------|-------------------------|----------------|
| Frontend           | Next.js 15 (App Router) | Vercel Pro     |
| Commerce backend   | Medusa.js v2            | Railway        |
| Database           | PostgreSQL (Supabase)   | Supabase       |
| Search             | Meilisearch             | Railway        |
| Email              | Resend + React Email    | Resend         |
| Payments           | PayFast + Ozow          | External       |
| Automation         | n8n                     | Railway        |

## Prerequisites

- Node 20+
- pnpm 9+
- PostgreSQL database (local or Supabase)
- Redis (for Medusa workers)

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env with your values
cp .env.example apps/web/.env.local
# Edit apps/web/.env.local with frontend-specific values
```

### 3. Run database migrations

```bash
./scripts/migrate.sh up
```

### 4. Start the development servers

```bash
pnpm dev
```

This starts:
- `http://localhost:3000` — Next.js frontend
- `http://localhost:9000` — Medusa backend + admin

## Repository Structure

```
tse-online/
├── apps/
│   ├── web/              # Next.js 15 frontend
│   └── backend/          # Medusa.js v2 backend
├── packages/
│   ├── ui/               # Shared shadcn/ui component library
│   ├── config/           # Shared Tailwind, ESLint, TS configs
│   └── types/            # Shared TypeScript interfaces
├── automation/
│   └── n8n/              # n8n workflow JSONs
├── docs/                 # Architecture & developer guides
└── scripts/              # DB helpers
```

## Common Commands

| Command             | Description                        |
|---------------------|------------------------------------|
| `pnpm dev`          | Start all apps in dev mode         |
| `pnpm build`        | Build all apps and packages        |
| `pnpm lint`         | Lint all workspaces                |
| `pnpm type-check`   | Run TypeScript checks everywhere   |

### Adding a shadcn/ui component

```bash
pnpm --filter @tse/web exec shadcn add button
```

### Running migrations

```bash
./scripts/migrate.sh up      # apply pending migrations
./scripts/migrate.sh down    # revert last migration
./scripts/migrate.sh status  # show migration status
```

## Deployment

See [docs/Architecture.md](docs/Architecture.md) for full deployment instructions.

- **Frontend**: Push to `main` → auto-deploys to Vercel
- **Backend**: Push to `main` → auto-deploys to Railway
- **Migrations**: `./scripts/migrate.sh up` after each deploy

## Commit Convention

```
feat:     new feature
fix:      bug fix
chore:    tooling, deps, config
docs:     documentation only
refactor: no behaviour change
test:     test additions/changes
```
