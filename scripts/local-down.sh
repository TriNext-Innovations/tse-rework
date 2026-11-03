#!/usr/bin/env bash
# Stop the local order-flow environment (#528). Data is kept; add --wipe to
# delete the local database and search index too.
set -euo pipefail
cd "$(dirname "$0")/.."
docker rm -f tse-local-tunnel >/dev/null 2>&1 || true
docker compose -p tse-local -f docker-compose.yml -f docker-compose.local.yml down $([ "${1:-}" = "--wipe" ] && echo -v)
