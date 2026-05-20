#!/bin/sh
set -e

export NODE_OPTIONS="--max-old-space-size=512"

echo "[medusa] Running database migrations..."
/app/node_modules/.bin/medusa db:migrate

echo "[medusa] Starting server..."
exec node .medusa/server/index.js
