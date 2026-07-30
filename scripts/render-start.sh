#!/bin/sh
set -e

mkdir -p /data

# Ensure SQLite schema exists on the persistent disk
export DATABASE_URL="${DATABASE_URL:-file:/data/photoreal.db}"
npx drizzle-kit push --force || true

exec node server.js
