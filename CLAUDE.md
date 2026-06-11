# CLAUDE.md — Flash-Sale Platform

Root guidance for AI agents working in this repository. Keep this file short; the
details live in modular files under `.claude/` (linked below).

## Project in one line

A flash-sale platform: many users buy limited stock at the same time. The hard
part is **correctness under concurrency** (no overselling), async order
processing, and real-time updates. The shop itself is intentionally minimal.

## Source of truth

Three documents define this project. Read them before non-trivial work and follow
them; do not invent requirements.

- `docs/vision-and-scope.md` — why the product exists and its boundaries.
- `docs/srs.md` — what the system must do (requirements with IDs FR-/NFR-/UR-).
- `docs/technical-design.md` — how it is built (architecture, flows, data model).

When code and docs disagree, stop and ask — do not silently diverge.

## Tech stack (fixed)

- Monorepo: **pnpm workspaces** (`apps/web`, `apps/api`, `apps/worker`,
  `packages/shared`).
- Frontend: **Next.js** + TypeScript.
- Backend: **Nest.js** × 2 (api + worker), TypeScript.
- DB: **PostgreSQL + pgvector** (Supabase, external), ORM **Prisma**.
- Cache / queue / pub-sub: **Redis** (Upstash, external) + **BullMQ**.
- Real-time: **Socket.IO** with the Redis adapter.
- AI: **Groq** (text only, rate-limited) — off the purchase path.
- Embeddings: **local** via transformers.js — background only.
- Deploy: **GCP e2-micro** + docker-compose; databases stay external.
