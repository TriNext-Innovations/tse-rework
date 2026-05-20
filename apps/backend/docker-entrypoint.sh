#!/bin/sh
set -e

export NODE_OPTIONS="--max-old-space-size=1536"

echo "[medusa] Starting server..."
exec node .medusa/server/index.js
