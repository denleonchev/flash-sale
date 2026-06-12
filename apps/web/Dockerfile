# Multi-stage build for @flash-sale/web (S-E0.3).
# Build context is the repo ROOT (set in docker-compose.prod.yml). Uses Next.js
# standalone output (next.config.ts: output:"standalone") so the runtime image
# carries no node_modules of its own.
# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

# ── deps + build ──────────────────────────────────────────────────────────────
FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @flash-sale/web...

COPY apps/web apps/web
RUN pnpm --filter @flash-sale/web build

# ── runtime ───────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
# Next standalone server reads PORT/HOSTNAME from env; bind all interfaces.
ENV HOSTNAME=0.0.0.0
WORKDIR /app
# Standalone bundle (traced from repo root → mirrors the monorepo layout) plus the
# static assets Next does not inline into the server bundle.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
