# Multi-stage build for @flash-sale/api (S-E0.3).
# Build context is the repo ROOT (set in docker-compose.prod.yml) so the whole
# pnpm workspace is available. ESM + tsc -b project references: building api also
# builds its workspace dep @flash-sale/shared.
# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

# ── deps + build ──────────────────────────────────────────────────────────────
FROM base AS build
# Manifests first for layer caching. All workspace manifests are needed so the
# frozen lockfile validates; the --filter then installs only api + its deps.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile --filter @flash-sale/api...

# Sources for api and its workspace dep, then build.
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @flash-sale/api build
# Pruned, self-contained output (dist + prod node_modules incl. built shared).
RUN pnpm --filter @flash-sale/api deploy --prod /app

# ── runtime ───────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
# API_PORT is provided at runtime via env (default 3001).
EXPOSE 3001
CMD ["node", "dist/main.js"]
