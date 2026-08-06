#!/usr/bin/env bash
#
# Boot a built backend image and require it to answer /health.
#
# This exists because `docker build` exit 0 tells you nothing about whether
# medusa starts. Medusa compiles src/api/** at RUNTIME, so a broken import —
# a dangling pnpm workspace symlink, a missing runtime dep — produces a green
# build and a crash-looping container. That is exactly how production went
# down on 2026-08-06.
#
# Used by scripts/prod-deploy.sh (before swapping live containers) and by CI.
#
# Usage:
#   scripts/smoke-backend-image.sh <image> [--network NET] [--timeout SECS]
#
# Env (required):
#   SMOKE_DATABASE_URL   postgres the container should connect to
#   SMOKE_REDIS_URL      redis the container should connect to
#
# Exit: 0 booted and healthy · 1 did not

set -uo pipefail

IMAGE="${1:-}"
[ -n "$IMAGE" ] || { echo "usage: $0 <image> [--network NET] [--timeout SECS]" >&2; exit 1; }
shift

NETWORK=""
TIMEOUT=300
while [ $# -gt 0 ]; do
  case "$1" in
    --network) NETWORK="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

: "${SMOKE_DATABASE_URL:?SMOKE_DATABASE_URL is required}"
: "${SMOKE_REDIS_URL:?SMOKE_REDIS_URL is required}"

NAME="tse-smoke-$$-$RANDOM"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

net_args=()
[ -n "$NETWORK" ] && net_args=(--network "$NETWORK")

# No published ports: the container cannot receive traffic, it only has to
# prove it starts. Secrets are throwaway — we never serve from this container.
docker run -d --name "$NAME" "${net_args[@]}" \
  -e DATABASE_URL="$SMOKE_DATABASE_URL" \
  -e REDIS_URL="$SMOKE_REDIS_URL" \
  -e JWT_SECRET=smoke-test \
  -e COOKIE_SECRET=smoke-test \
  -e STORE_CORS=http://localhost:3000 \
  -e ADMIN_CORS=http://localhost:9000 \
  -e AUTH_CORS=http://localhost:3000 \
  -e R2_ACCESS_KEY_ID=smoke -e R2_SECRET_ACCESS_KEY=smoke -e R2_BUCKET=smoke \
  -e R2_ENDPOINT=http://127.0.0.1:9999 -e R2_PUBLIC_URL=http://127.0.0.1:9999 \
  -e NODE_ENV=production \
  "$IMAGE" >/dev/null 2>&1 || { echo "✗ could not start a container from $IMAGE"; exit 1; }

echo "  smoke: booting $IMAGE (timeout ${TIMEOUT}s)…"
elapsed=0
while [ "$elapsed" -lt "$TIMEOUT" ]; do
  if docker exec "$NAME" wget -qO- http://127.0.0.1:9000/health >/dev/null 2>&1; then
    echo "  ✓ SMOKE PASS — $IMAGE booted and answered /health in ~${elapsed}s"
    exit 0
  fi
  if ! docker ps --format '{{.Names}}' | grep -qx "$NAME"; then
    echo "  ✗ SMOKE FAIL — container exited after ~${elapsed}s"
    break
  fi
  sleep 5; elapsed=$((elapsed+5))
done

[ "$elapsed" -ge "$TIMEOUT" ] && echo "  ✗ SMOKE FAIL — no /health response within ${TIMEOUT}s"

echo "  ── diagnostic (matched error lines) ──"
docker logs "$NAME" 2>&1 \
  | grep -iE "Cannot find module|Unable to compile|error TS[0-9]|Error starting server|Invalid URL|ECONNREFUSED|password authentication" \
  | head -5 | sed 's/^/  /'
exit 1
