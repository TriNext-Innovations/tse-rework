#!/usr/bin/env bash
# TSE Online — Database migration helper
# Usage: ./scripts/migrate.sh [up|down|status]

set -euo pipefail

ACTION="${1:-up}"
BACKEND_DIR="$(dirname "$0")/../apps/backend"

echo "Running migrations: $ACTION"

cd "$BACKEND_DIR"

case "$ACTION" in
  up)
    npx medusa migrations run
    ;;
  down)
    npx medusa migrations revert
    ;;
  status)
    npx medusa migrations show
    ;;
  *)
    echo "Usage: $0 [up|down|status]"
    exit 1
    ;;
esac

echo "Done"
