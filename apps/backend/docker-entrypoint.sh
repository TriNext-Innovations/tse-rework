#!/bin/sh
set -e

export NODE_OPTIONS="--max-old-space-size=1536"

echo "[medusa] Running database migrations..."
/app/node_modules/.bin/medusa db:migrate

echo "[medusa] Starting server..."
exec /app/node_modules/.bin/medusa start
