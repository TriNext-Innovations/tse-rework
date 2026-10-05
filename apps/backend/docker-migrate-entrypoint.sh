#!/bin/sh
set -e

# Two app boots, not seven (#490): each `medusa exec` boots the whole app
# (~20s), so the TSE steps share one. See src/scripts/migrate-tse.ts.

echo "[migrate] Running Medusa migrations..."
/app/node_modules/.bin/medusa db:migrate

echo "[migrate] Running TSE tables + compatibility seed (seed only if its CSV changed)..."
/app/node_modules/.bin/medusa exec src/scripts/migrate-tse.ts

echo "[migrate] All done."
