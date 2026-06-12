# Multi-stage build for @flash-sale/worker (S-E0.3).
# Build context is the repo ROOT (set in docker-compose.prod.yml). The worker is a
# queue consumer that also serves a minimal GET /health for the compose healthcheck.
# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

# ── deps + build ──────────────────────────────────────────────────────────────
FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile --filter @flash-sale/worker...

COPY packages/shared packages/shared
COPY apps/worker apps/worker
RUN pnpm --filter @flash-sale/worker build
RUN pnpm --filter @flash-sale/worker deploy --prod /app

# ── runtime ───────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
# WORKER_PORT is provided at runtime via env (default 3002); only /health is served.
EXPOSE 3002
CMD ["node", "dist/main.js"]
