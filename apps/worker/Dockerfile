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

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
# pnpm deploy --ignore-scripts skips sharp's postinstall that downloads the prebuilt .node binary.
# Re-run install/check.js from each sharp package root to fetch the correct linux-x64 binary.
RUN find /app/node_modules -name "check.js" -path "*/sharp/install/check.js" | \
    while read f; do (cd "${f%/install/check.js}" && node install/check.js); done
EXPOSE 3002
CMD ["node", "dist/main.js"]
