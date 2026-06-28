# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
# Full db copy needed: postinstall runs `prisma generate && tsc` during pnpm install.
COPY packages/db packages/db
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
# prisma generate (in packages/db postinstall) calls env("DATABASE_URL") at build time;
# no real connection is made — any valid URL format satisfies the check.
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm install --frozen-lockfile --filter @flash-sale/web...

COPY packages/shared/src packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/
RUN pnpm --filter @flash-sale/shared build

COPY apps/web apps/web
# NEXT_PUBLIC_* vars are inlined at build time — must be available here, not only at runtime.
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
RUN pnpm --filter @flash-sale/web build

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
