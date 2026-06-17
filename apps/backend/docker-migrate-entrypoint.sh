#!/bin/sh
set -e

echo "[migrate] Running Medusa migrations..."
/app/node_modules/.bin/medusa db:migrate

echo "[migrate] Ensuring compatibility tables (idempotent)..."
/app/node_modules/.bin/medusa exec src/scripts/migrate-compatibility.ts

echo "[migrate] Adding search_name column + trigram index (idempotent)..."
/app/node_modules/.bin/medusa exec src/scripts/migrate-compatibility-v2.ts

echo "[migrate] Seeding compatibility data (idempotent upsert)..."
/app/node_modules/.bin/medusa exec src/scripts/seed-compatibility.ts

echo "[migrate] All done."
