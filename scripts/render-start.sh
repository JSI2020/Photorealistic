#!/bin/sh
set -e

mkdir -p /data /tmp || true

# Render injects PORT (often 10000). Never hard-bind only to 3000.
export PORT="${PORT:-10000}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"

echo "[start] build=${BUILD_ID:-unknown} PORT=$PORT NODE_ENV=$NODE_ENV DATABASE_URL=$DATABASE_URL NODE_OPTIONS=$NODE_OPTIONS"
exec node server.js
