# syntax=docker/dockerfile:1

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
# Full db copy needed: postinstall runs `prisma generate && tsc` during pnpm install.
COPY packages/db packages/db
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
# prisma generate (in packages/db postinstall) calls env("DATABASE_URL") at build time;
# no real connection is made — any valid URL format satisfies the check.
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm install --frozen-lockfile --filter @flash-sale/worker...

COPY packages/shared packages/shared
COPY apps/worker apps/worker
RUN pnpm --filter @flash-sale/worker build
# --ignore-scripts: prisma client is already generated above; skipping postinstall
# avoids "prisma: not found" — prisma is a devDep and is absent in the prod deploy.
RUN pnpm --filter @flash-sale/worker deploy --prod --ignore-scripts /app
# sharp's .node binary is downloaded by its install script and is NOT in pnpm's content
# store, so pnpm deploy omits it. Copy the entire build/Release dir explicitly.
RUN find /repo/node_modules/.pnpm -path "*/sharp/build/Release" -type d | while read d; do \
      target="/app${d#/repo}"; mkdir -p "$target"; cp -r "$d/." "$target/"; \
    done

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
# libvips is a runtime dependency of sharp (used by @xenova/transformers for embeddings).
# node:22-slim doesn't include it; the bundled .so files in build/Release need it too.
RUN apt-get update && apt-get install -y --no-install-recommends libvips42 wget && rm -rf /var/lib/apt/lists/*
COPY --from=build /app /app
EXPOSE 3002
CMD ["node", "dist/main.js"]
