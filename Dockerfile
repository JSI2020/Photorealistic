# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Strip native modules so Next standalone cannot trace/load them (exit 139).
RUN npm uninstall --ignore-scripts sharp better-sqlite3 || true
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=1536
ENV DOCKER_BUILD=1
ENV BUILD_ID=json-no-native
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=10000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/data/photoreal.db
ENV ENABLE_SHARP=0
ENV NODE_OPTIONS=--max-old-space-size=384
ENV BUILD_ID=json-no-native

RUN mkdir -p /data /tmp

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY scripts/render-start.sh ./scripts/render-start.sh
RUN chmod +x ./scripts/render-start.sh \
  && rm -rf ./node_modules/sharp ./node_modules/@img ./node_modules/better-sqlite3 2>/dev/null || true \
  && find . -type d \( -name sharp -o -name better-sqlite3 -o -name '@img' \) -prune -exec rm -rf {} + 2>/dev/null || true

EXPOSE 10000
CMD ["./scripts/render-start.sh"]
