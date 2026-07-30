#!/bin/sh
set -e

# Prefer persistent disk; fall back is handled in app code if not writable
mkdir -p /data /tmp || true

echo "[start] NODE_ENV=$NODE_ENV DATABASE_URL=$DATABASE_URL"
exec node server.js
