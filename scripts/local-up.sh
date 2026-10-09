#!/usr/bin/env bash
# Local order-flow environment (#528): seed data only, nothing from prod.
#
#   ./scripts/local-up.sh            infra + setup + tunnel + backend + storefront
#   ./scripts/local-up.sh --setup    infra + setup only, then exit
#   ./scripts/local-down.sh          stop the tunnel and containers (data kept)
#
# Safe to re-run: the seed and setup steps only run on an empty database.
# Ctrl+C stops the backend, storefront, mail sink and tunnel.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$PWD
BE=apps/backend/.env
WEB=apps/web/.env.local
SECRETS=${TSE_LOCAL_ENV:-$HOME/.config/tse-local/backend.env}
COMPOSE=(docker compose -p tse-local -f docker-compose.yml -f docker-compose.local.yml)
MEILI_KEY=local-meili-master-key-0123456789

say() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
setenv() { # setenv FILE KEY VALUE — replace or append
  if grep -q "^$2=" "$1"; then sed -i "s#^$2=.*#$2=$3#" "$1"; else echo "$2=$3" >> "$1"; fi
}
node20() { mise exec node@20 -- "$@"; }
be() { (cd apps/backend && node20 pnpm "$@"); }

# ── Env files ────────────────────────────────────────────────────────────────
[ -f .env ] || printf 'POSTGRES_PASSWORD=localtest\nMEILISEARCH_API_KEY=%s\n' "$MEILI_KEY" > .env
if [ ! -f "$BE" ]; then
  if [ -f "$SECRETS" ]; then cp "$SECRETS" "$BE"; echo "using $SECRETS"
  else cp apps/backend/.env.local-test.example "$BE"; echo "created $BE from the example"; fi
fi
grep -q '^EMAIL_REDIRECT_TO=.\+' "$BE" || { echo "EMAIL_REDIRECT_TO is empty in $BE — refusing to run"; exit 1; }
grep -q '^DATABASE_URL=.*@localhost' "$BE" || { echo "DATABASE_URL in $BE is not localhost — refusing to run"; exit 1; }
grep -q '^PAYFAST_MERCHANT_ID=.\+' "$BE" || echo "warning: no PayFast sandbox creds in $BE — checkout will fail, the test payment still works"

USE_SINK=0
grep -q '^ZEPTOMAIL_TOKEN=.\+' "$BE" || USE_SINK=1
grep -q '^ZEPTOMAIL_API_URL=' "$BE" && USE_SINK=1
if [ $USE_SINK = 1 ]; then
  setenv "$BE" ZEPTOMAIL_TOKEN "$(grep '^ZEPTOMAIL_TOKEN=' "$BE" | cut -d= -f2- | grep . || echo local)"
  setenv "$BE" ZEPTOMAIL_API_URL http://127.0.0.1:8025
fi

# ── Infra + database ─────────────────────────────────────────────────────────
[ -d node_modules ] || { say "Installing dependencies"; node20 pnpm install --frozen-lockfile; }

say "Postgres, Redis, Meilisearch"
"${COMPOSE[@]}" up -d --wait postgres redis meilisearch

say "Migrations"
be migrate >/dev/null
be migrate:tse >/dev/null

PRODUCTS=$(docker exec tse-local-postgres-1 psql -U postgres -d tse_medusa -tAc "select count(*) from product" 2>/dev/null || echo 0)
if [ "${PRODUCTS// /}" = "0" ]; then
  say "Seeding (first run, a few minutes)"
  be exec medusa exec src/scripts/seed.ts >/dev/null
  be local:setup
  be shipping:setup | grep '^\[setup' || true
  be payfast:setup | grep '^\[setup' || true
  be search:index | grep 'done' || true
  be exec medusa user -e admin@local.test -p localtest123 >/dev/null 2>&1 || true
else
  echo "database already seeded ($PRODUCTS products) — skipping seed"
fi

# ── Storefront env ───────────────────────────────────────────────────────────
PK=$(be -s key 2>/dev/null | grep -o 'pk_[A-Za-z0-9]*' | head -1)
SK=$(curl -s -H "Authorization: Bearer $MEILI_KEY" http://127.0.0.1:7700/keys \
  | node20 node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const k=JSON.parse(s).results.find(k=>k.actions.length===1&&k.actions[0]==="search");console.log(k?k.key:"")})')
cat > "$WEB" <<EOF
NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$PK
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_MEILISEARCH_HOST=http://localhost:7700
NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY=$SK
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_SEARCH_KEY=$SK
EOF

[ "${1:-}" = "--setup" ] && { say "Setup done"; exit 0; }

# ── Tunnel (PayFast must reach the backend for the ITN) ──────────────────────
say "Cloudflare tunnel"
docker rm -f tse-local-tunnel >/dev/null 2>&1 || true
docker run -d --name tse-local-tunnel --network host cloudflare/cloudflared:latest \
  tunnel --no-autoupdate --url http://127.0.0.1:9000 >/dev/null
TUNNEL=""
for _ in $(seq 1 30); do
  TUNNEL=$(docker logs tse-local-tunnel 2>&1 | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | head -1 || true)
  [ -n "$TUNNEL" ] && break; sleep 1
done
[ -n "$TUNNEL" ] || { echo "tunnel did not come up — PayFast callbacks will not arrive"; exit 1; }
setenv "$BE" MEDUSA_BACKEND_URL "$TUNNEL"
setenv "$BE" ADMIN_CORS "http://localhost:9000,http://localhost:3000,$TUNNEL"
setenv "$BE" AUTH_CORS "http://localhost:9000,http://localhost:3000,$TUNNEL"
echo "$TUNNEL"

# ── Apps ─────────────────────────────────────────────────────────────────────
trap 'docker rm -f tse-local-tunnel >/dev/null 2>&1; kill 0' EXIT
[ $USE_SINK = 1 ] && node20 node scripts/local-mail-sink.mjs &
(cd apps/backend && node20 pnpm dev) &
(cd apps/web && node20 pnpm dev) &

say "Ready in ~30s"
cat <<EOF
  Storefront  http://localhost:3000
  Admin       http://localhost:9000/app   (admin@local.test / localtest123)
  Emails      $([ $USE_SINK = 1 ] && echo "$ROOT/.local-mail/" || echo "$(grep '^EMAIL_REDIRECT_TO=' "$BE" | cut -d= -f2) via ZeptoMail")
  Ctrl+C stops everything.
EOF
wait
