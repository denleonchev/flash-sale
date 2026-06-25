# Rule: Boundaries — what the agent may and may not run

The rule of thumb: **changes state or schema → the human runs it. Pure local code
→ the agent may run it.**

## The agent MAY run by itself
- Writing, editing, and deleting source files in the repo.
- Formatting and linting.
- Local type-checking and local builds that do not touch external services.
- Generating code, Prisma schema edits (`schema.prisma` only).
  **Never hand-write migration SQL files** — Prisma generates them via
  `prisma migrate dev --name <x>` (human runs this). Checksums are stored in
  `_prisma_migrations`; a hand-written file will diverge and break `migrate deploy`.

## The agent MUST NOT run — propose, and let the human run
- **Database migrations** (`prisma migrate ...`, `prisma db push`, resets).
- **Any command against external services** (Supabase, Upstash) — including seeds,
  queries, queue flushes.
- **Dependency installs** (`pnpm add ...`, `pnpm install`) — propose the exact
  command.
- **Deploys** and anything touching the VM or docker-compose against real infra.
- **Anything destructive or irreversible** (drop, truncate, reset, force-push).

When a forbidden command is needed: print the exact command, say what it will do
and what it will change, and stop. Wait for the human to run it and report back.

## Secrets
- Never read, print, or commit secrets (DB URLs, Redis URLs, API keys).
- Configuration comes from environment variables; reference variable names, never
  values.
