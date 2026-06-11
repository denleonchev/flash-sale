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

## Modular guidance

Rules (always apply):

- `.claude/rules/boundaries.md` — what the agent may and may not run.
- `.claude/rules/scope-discipline.md` — build order; core first, extras last.
- `.claude/rules/concurrency.md` — special care for the oversell-prevention code.
- `.claude/rules/coding-style.md` — conventions for this repo.

Skills (how to do recurring tasks):

- `.claude/skills/add-prisma-model.md`
- `.claude/skills/add-queue-job.md`
- `.claude/skills/add-socket-event.md`

Subagents (specialised roles):

- `.claude/agents/reviewer.md`
- `.claude/agents/concurrency-auditor.md`

## Golden rules (summary — full text in the rule files)

1. **The agent writes and proposes; the human runs anything that changes state.**
   Migrations, commands against Supabase/Upstash, installs, and deploys are run by
   the human. Pure local code (writing files, formatting, local build) the agent
   may run itself. See `boundaries.md`.
2. **Core before extras.** Never start an [Ext] feature while [Core] is unfinished.
   See `scope-discipline.md`.
3. **Concurrency code is proposed with an explanation and verified by the human.**
   Never treat oversell-prevention code as done without reasoning. See
   `concurrency.md`.
4. **Follow the docs.** If a requirement is unclear or missing, ask — don't guess.
