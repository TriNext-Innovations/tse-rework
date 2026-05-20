#!/bin/sh
set -e

echo "[medusa] Running database migrations..."
/app/node_modules/.bin/medusa migrations run

echo "[medusa] Starting server..."
exec node .medusa/server/index.js
