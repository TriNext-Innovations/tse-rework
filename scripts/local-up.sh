#!/usr/bin/env bash
# Local order-flow environment (#528): seed data only, nothing from prod.
# Brings up Postgres/Redis/Meilisearch, migrates, seeds, and sets up the
# warehouse, shipping, PayFast sandbox and search. Safe to re-run.
# Then start the apps by hand; see docs/LOCAL-ORDER-FLOW.md.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f apps/backend/.env ] || { echo "apps/backend/.env missing — copy it from docs/LOCAL-ORDER-FLOW.md"; exit 1; }
grep -q '^EMAIL_REDIRECT_TO=.\+' apps/backend/.env || { echo "EMAIL_REDIRECT_TO is not set in apps/backend/.env — refusing to run"; exit 1; }

docker compose -p tse-local -f docker-compose.yml -f docker-compose.local.yml up -d --wait postgres redis meilisearch

be() { (cd apps/backend && pnpm "$@"); }
be migrate
be migrate:tse
be exec medusa exec src/scripts/seed.ts
be local:setup
be shipping:setup
be payfast:setup
be search:index
be exec medusa user -e admin@local.test -p localtest123 || true   # already exists on re-runs

echo
echo "Publishable key for apps/web/.env.local:"
be -s key
