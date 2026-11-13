#!/usr/bin/env bash
#
# Full-stack E2E (#571): the real Medusa backend + Postgres + Redis +
# Meilisearch, seeded from migration/seed-data.json, the storefront's
# production build, and Playwright driving a customer through it.
#
# Why: apps/web/e2e runs against fixtures with no backend, so a Medusa,
# payment-module or override change could break checkout and CI stayed green.
# Nightly dependency merges deploy straight to prod (no staging), so this
# suite is the gate for them (trinext-ai-hive#16): red here means a customer
# flow is broken.
#
# Usage:  scripts/e2e-fullstack.sh            (CI and local)
#         KEEP=1 scripts/e2e-fullstack.sh     (leave the stack running)
#
# Runs under its own compose project (tse-e2e) with fresh volumes, so it never
# touches a developer's tse-local data — but it needs ports 5432, 6379, 7700,
# 8025, 9000 and 3000 free (stop tse-local first: scripts/local-down.sh).
# Nothing leaves the machine: emails go to the local mail sink, the courier is
# TCG_FAKE, and PayFast is intercepted in the browser before the redirect.

set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$PWD
export TSE_LOCAL_PROJECT=tse-e2e
# Never pick up a developer's real sandbox secrets from ~/.config.
export TSE_LOCAL_ENV=/nonexistent/tse-e2e.env
BE=apps/backend/.env
LOGS=$ROOT/.e2e-logs
COMPOSE=(docker compose -p tse-e2e -f docker-compose.yml -f docker-compose.local.yml)
node20() { if [ -n "${CI:-}" ] || ! command -v mise >/dev/null; then "$@"; else mise exec node@20 -- "$@"; fi; }

say() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
setenv() { if grep -q "^$2=" "$1"; then sed -i "s#^$2=.*#$2=$3#" "$1"; else echo "$2=$3" >> "$1"; fi; }

cleanup() {
  [ -n "${KEEP:-}" ] && { echo "KEEP=1 — stack left running"; return; }
  # Kill by port: pnpm wrappers die with `kill $(jobs -p)` but the node
  # processes under them keep the ports, and the next run then talks to a
  # stale server without noticing.
  for port in 9000 3000 8025; do
    for pid in $(ss -ltnp 2>/dev/null | grep ":$port " | grep -o 'pid=[0-9]*' | cut -d= -f2); do kill "$pid" 2>/dev/null || true; done
  done
  # shellcheck disable=SC2046
  kill $(jobs -p) 2>/dev/null || true
  "${COMPOSE[@]}" down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

for port in 9000 3000 8025; do
  if ss -ltn 2>/dev/null | grep -q ":$port "; then echo "port $port is busy — stop whatever is on it first"; exit 1; fi
done
mkdir -p "$LOGS"
rm -rf .local-mail

say "Backend env (example + throwaway PayFast credentials)"
if [ ! -f "$BE" ]; then
  cp apps/backend/.env.local-test.example "$BE"
fi
grep -q '^DATABASE_URL=.*@localhost' "$BE" || { echo "DATABASE_URL in $BE is not localhost — refusing to run"; exit 1; }
# Any merchant id/key signs a redirect; nothing is ever POSTed to PayFast —
# the browser test intercepts the form. Never real credentials here.
setenv "$BE" PAYFAST_SANDBOX true
setenv "$BE" PAYFAST_MERCHANT_ID 10000100
setenv "$BE" PAYFAST_MERCHANT_KEY 46f0cd694581a
setenv "$BE" PAYFAST_PASSPHRASE e2e-passphrase
setenv "$BE" TCG_FAKE true
setenv "$BE" ZEPTOMAIL_TOKEN e2e
setenv "$BE" ZEPTOMAIL_API_URL http://127.0.0.1:8025
setenv "$BE" EMAIL_REDIRECT_TO e2e-inbox@example.com

say "Infra, migrations, seed, shipping, search index, admin user"
TSE_LOCAL_PROJECT=tse-e2e ./scripts/local-up.sh --setup

say "Building backend and storefront (production builds)"
(cd apps/backend && node20 pnpm build) >"$LOGS/backend-build.log" 2>&1 || { tail -40 "$LOGS/backend-build.log"; exit 1; }
(cd apps/web && node20 pnpm build) >"$LOGS/web-build.log" 2>&1 || { tail -40 "$LOGS/web-build.log"; exit 1; }

# Same layout as the prod image (apps/backend/Dockerfile): medusa start serves
# the admin from ./public, which the build leaves in dist/public.
rm -rf apps/backend/public && cp -r apps/backend/dist/public apps/backend/public

say "Starting mail sink, backend, storefront"
node20 node scripts/local-mail-sink.mjs >"$LOGS/mail-sink.log" 2>&1 &
(cd apps/backend && NODE_ENV=production node20 pnpm start) >"$LOGS/backend.log" 2>&1 &
(cd apps/web && node20 pnpm start -p 3000) >"$LOGS/web.log" 2>&1 &

wait_for() { # url seconds
  for _ in $(seq 1 "$2"); do curl -fsS -o /dev/null -m 5 "$1" && return 0; sleep 1; done
  echo "timed out waiting for $1"; return 1
}
wait_for http://localhost:9000/health 240 || { tail -60 "$LOGS/backend.log"; exit 1; }
wait_for http://localhost:3000/api/health 120 || { tail -60 "$LOGS/web.log"; exit 1; }

say "Playwright (full stack)"
export E2E_MAIL_DIR="$ROOT/.local-mail"
export E2E_BACKEND_URL=http://localhost:9000
E2E_PUBLISHABLE_KEY=$(grep '^NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=' apps/web/.env.local | cut -d= -f2)
export E2E_PUBLISHABLE_KEY
(cd apps/web && node20 pnpm exec playwright test -c playwright.fullstack.config.ts)
