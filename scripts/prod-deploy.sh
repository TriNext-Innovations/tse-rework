#!/usr/bin/env bash
#
# Manual production deploy — the break-glass path for when GitHub Actions is
# unavailable. Mirrors .github/workflows/deploy.yml, plus the one gate CI does
# not have: it BOOTS the newly built backend image and waits for /health
# BEFORE any live container is swapped.
#
# That ordering is the whole point. On 2026-08-06 a dangling pnpm workspace
# symlink meant the backend image built green and then crash-looped on start
# (medusa compiles src/api/** at RUNTIME, not at build time). `docker build`
# exit 0 proves nothing about boot. The deploy swapped medusa first and found
# out in production — 502 for ~3 minutes. With this script the smoke gate
# fails and the live containers are never touched.
#
# Run ON the box:
#   cd /opt/tse-ui && ./scripts/prod-deploy.sh
#
# Options:
#   --ref <git-ref>   deploy something other than origin/main
#   --check-only      preflight + build + smoke test, then stop. Touches
#                     nothing live. Safe to run any time, including as a
#                     rehearsal while the site serves traffic.
#   --no-backup       skip the pre-deploy pg_dump (not recommended)
#
# Exit codes: 0 ok · 1 preflight/build/smoke failed (nothing swapped)
#             2 deploy failed after swapping (rollback attempted)

set -euo pipefail

REF="origin/main"
CHECK_ONLY=0
DO_BACKUP=1
SMOKE_NAME="tse-smoke-$$"
SWAPPED=0

while [ $# -gt 0 ]; do
  case "$1" in
    --ref) REF="$2"; shift 2 ;;
    --check-only) CHECK_ONLY=1; shift ;;
    --no-backup) DO_BACKUP=0; shift ;;
    -h|--help) sed -n '2,28p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

say()  { printf '\n▶ %s\n' "$*"; }
ok()   { printf '  ✓ %s\n' "$*"; }
die()  { printf '\n✗ %s\n' "$*" >&2; exit "${2:-1}"; }

cleanup() {
  docker rm -f "$SMOKE_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# ── Rollback ────────────────────────────────────────────────────────────────
# Only meaningful once we've started swapping. Restores the images that were
# serving traffic before this run (tagged in "Tag rollback images" below).
rollback() {
  say "DEPLOY FAILED — rolling back to the previously running images"
  local project; project=$(basename "$PWD")
  for svc in medusa web; do
    if docker image inspect "tse-rollback-$svc:latest" >/dev/null 2>&1; then
      docker tag "tse-rollback-$svc:latest" "$project-$svc:latest" && ok "restored $project-$svc"
    else
      echo "  ⚠ no rollback image for $svc"
    fi
  done
  docker compose up -d --no-build
  docker compose exec -T nginx nginx -s reload || echo "  ⚠ nginx reload failed"
  sleep 20
  curl -sf http://localhost:9000/health >/dev/null && ok "Medusa healthy after rollback" \
    || echo "  ⚠ Medusa STILL unhealthy after rollback — investigate now"
  curl -sfo /dev/null https://tse-cartridges.co.za && ok "storefront healthy after rollback" \
    || echo "  ⚠ storefront STILL unhealthy after rollback — investigate now"
  die "rolled back; production should be on the previous release" 2
}

# ── 1. Preflight ────────────────────────────────────────────────────────────
say "Preflight"
[ -f docker-compose.yml ] || die "run this from the project root (e.g. /opt/tse-ui)"
docker compose version >/dev/null 2>&1 || die "docker compose unavailable"
docker compose ps --status running --format '{{.Service}}' | grep -q postgres \
  || die "postgres is not running — refusing to deploy"
avail=$(df -Pk . | awk 'NR==2{print int($4/1048576)}')
[ "$avail" -ge 3 ] || die "only ${avail}GB free — image builds need headroom"
ok "compose up, postgres running, ${avail}GB free"

# ── 2. Backup ───────────────────────────────────────────────────────────────
if [ "$DO_BACKUP" = 1 ]; then
  say "Backing up the database (migrations run later in this script)"
  mkdir -p backups
  f="backups/tse_predeploy_$(date +%F_%H%M).sql.gz"
  docker compose exec -T postgres pg_dump -U postgres -d tse_medusa --no-owner --clean | gzip > "$f"
  ok "$f ($(du -h "$f" | cut -f1))"
fi

# ── 3. Checkout ─────────────────────────────────────────────────────────────
say "Fetching and checking out $REF"
git stash push -m "auto-stash before manual deploy $(date -u +%FT%TZ)" >/dev/null 2>&1 \
  && echo "  (stashed local changes — recover with 'git stash list')" || true
git fetch origin --prune
git reset --hard "$REF"
ok "$(git log -1 --oneline)"

# ── 4. Tag rollback images ──────────────────────────────────────────────────
say "Tagging currently-running images for rollback"
for svc in medusa web; do
  id=$(docker compose images "$svc" --format json 2>/dev/null | grep -oP '"ID":"\K[^"]+' | head -1)
  if [ -n "${id:-}" ]; then docker tag "$id" "tse-rollback-$svc:latest" && ok "$svc"; else echo "  (no running $svc image)"; fi
done

# ── 5. Build ────────────────────────────────────────────────────────────────
say "Building new images (live containers keep serving)"
docker compose pull --quiet
docker compose build
ok "images built"

# ── 6. Smoke test — THE GATE CI DOES NOT HAVE ───────────────────────────────
# Start the freshly built backend as a throwaway container using the compose
# service's own env, and require /health. `docker compose run` picks up the
# image we just built. No ports published, so it cannot receive traffic; it
# talks to the same DB, which is safe — medusa only reads on boot, and
# migrations are a separate service run in step 7.
say "Smoke test: booting the NEW backend image before touching anything live"
project=$(basename "$PWD")
image="$project-medusa:latest"
# Point the throwaway container at the same infrastructure the live stack
# uses. .env may address these as localhost (for host-side tooling); inside
# the compose network they are service names.
smoke_db=$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#@localhost:#@postgres:#')
smoke_redis=$(grep -m1 '^REDIS_URL=' .env | cut -d= -f2- | sed 's#@localhost:#@redis:#; s#//localhost:#//redis:#')

SMOKE_DATABASE_URL="$smoke_db" SMOKE_REDIS_URL="$smoke_redis" \
  ./scripts/smoke-backend-image.sh "$image" --network "${project}_default" --timeout 300 \
  || die "SMOKE TEST FAILED — the new image does not boot. Nothing was swapped; production is untouched and still serving the previous release."

if [ "$CHECK_ONLY" = 1 ]; then
  say "--check-only: stopping here. Nothing live was modified."
  exit 0
fi

# ── 7. Migrate (gate) ───────────────────────────────────────────────────────
# -T matters: without it, `docker compose run` grabs stdin. If this script is
# ever piped into a shell (ssh 'bash -s'), it eats the rest of the script and
# the deploy silently stops here with exit 0.
say "Running database migrations (must exit 0)"
docker compose run --rm -T --no-deps medusa-migrate || die "migrations failed — nothing swapped"
ok "migrations applied"

# ── 8. Rolling swap ─────────────────────────────────────────────────────────
SWAPPED=1
say "Rolling: medusa"
docker compose up -d --no-deps --no-build --wait --wait-timeout 420 medusa || rollback
docker compose exec -T nginx nginx -s reload || rollback
curl -sf http://localhost:9000/health >/dev/null || rollback
ok "medusa healthy"

say "Rolling: web"
docker compose up -d --no-deps --no-build --wait --wait-timeout 180 web || rollback
docker compose exec -T nginx nginx -s reload || rollback
curl -sf http://localhost:3000/api/health >/dev/null || rollback
ok "web healthy"

say "Syncing remaining services"
docker compose up -d --no-build --remove-orphans || rollback
docker compose exec -T nginx nginx -s reload || true

# ── 9. Public checks (what customers actually hit) ──────────────────────────
say "Public health checks via nginx"
for u in https://tse-cartridges.co.za \
         https://api.tse-cartridges.co.za/health \
         https://tse-cartridges.co.za/products; do
  curl -sfo /dev/null --retry 3 --retry-delay 5 --retry-all-errors "$u" \
    && ok "$u" || rollback
done

say "✓ Deploy complete — $(git log -1 --oneline)"
