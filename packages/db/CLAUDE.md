# CLAUDE.md — packages/db (Prisma)

This file adds rules only for db. The root `CLAUDE.md` and `.claude/rules/*` still
apply. Do not repeat them here. See also `.claude/skills/add-prisma-model.md`.

## What this package is

The one Prisma schema, migrations and generated client for the whole repo. api and
worker import `@flash-sale/db`. The data model's source of truth is
`docs/technical-design.md` §5.

## Rules

- Migrations are applied by the human (`prisma migrate dev` connects to Supabase).
  The agent writes `schema.prisma` and commits migration files — never applies them.
- Change the schema, then create a new migration (`prisma migrate dev --name x`).
  Never hand-edit an applied migration.
- **Vector (hnsw) indexes are invisible to Prisma** — it has no such index type, so the
  schema diff treats `sales_embedding_hnsw` / `fraud_flags_embedding_hnsw` as drift and
  emits `DROP INDEX` for them. It has already deleted them twice. Create migrations with
  `pnpm migrate:new` (`--create-only`), delete any generated `DropIndex ..._hnsw` line,
  then apply. The opclass must match the query operator: `vector_cosine_ops` for `<=>`
  (sales search, FR-26), `vector_l2_ops` for `<->` (fraud RAG, FR-27).
- Sale state (upcoming/live/ended) is derived from time + stock — never stored (FR-2).
- The generated client lives in `generated/` (git-ignored) and is rebuilt by
  `postinstall: prisma generate`. Do not commit it.
- This package is CommonJS (no `"type": "module"`) to match Prisma's generated client,
  and is outside the root `tsc -b`.
- Prisma 7: the connection URL lives in `prisma.config.ts` (not in the schema's
  datasource), loaded from env via `dotenv`. Config comes from env only — reference
  `DATABASE_URL` by name, never the value (NFR-8). For Supabase migrations it must be
  the direct connection (port 5432).
