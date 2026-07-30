# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=4096
ENV DOCKER_BUILD=1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/data/photoreal.db

# Run as root on Render free tier so /data disk mounts are writable.
RUN mkdir -p /data /tmp

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Native module for SQLite — install into runtime image
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/.npmrc ./.npmrc
RUN npm install --omit=dev better-sqlite3 sharp

COPY scripts/render-start.sh ./scripts/render-start.sh
RUN chmod +x ./scripts/render-start.sh

EXPOSE 3000
CMD ["./scripts/render-start.sh"]
