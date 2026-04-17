# TSE Online — E-Commerce Platform

Custom-built headless e-commerce platform for TSE Online, a South African
printer cartridge supplier.

## Stack

Next.js 15 · Medusa.js v2 · Supabase · Tailwind CSS · shadcn/ui ·
Meilisearch · Sanity · n8n · PayFast · Ozow · Resend · Cloudflare

## Documentation

| Document | Purpose |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Full system architecture, data flow, DB schema, env vars, deployment |
| [docs/DEVELOPER-GUIDE.md](docs/DEVELOPER-GUIDE.md) | Local setup, git workflow, testing, migrations, go-live checklist |
| [docs/AI-CODE-PROMPTS.md](docs/AI-CODE-PROMPTS.md) | Ready-to-use prompts for generating each major component with Claude |
| [docs/RETAINER-SCOPE.md](docs/RETAINER-SCOPE.md) | Monthly retainer services, SLAs, and handover terms |

## Quick Start

```bash
pnpm install
cp .env.example apps/web/.env.local
cp .env.example apps/backend/.env
docker-compose up -d
pnpm --filter backend medusa db:migrate
pnpm dev
```

## Key URLs

| Environment | Frontend | Admin | API |
|---|---|---|---|
| Local | http://localhost:3000 | http://localhost:9000/app | http://localhost:9000 |
| Staging | https://staging.tseonline.co.za | — | https://api-staging.tseonline.co.za |
| Production | https://tseonline.co.za | https://admin.tseonline.co.za | https://api.tseonline.co.za |

## Client

**TSE Online**  
Contact: [TBD]  
Project start: April 2026  
Go-live target: June 2026
