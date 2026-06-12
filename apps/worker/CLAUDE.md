# CLAUDE.md — apps/worker (Nest)

This file adds rules only for worker. The root `CLAUDE.md` and `.claude/rules/*`
(boundaries, concurrency, scope-discipline, coding-style) still apply. Do not repeat
them here.

## What this service is

A background worker. It consumes the queue and processes orders one at a time — see
`docs/technical-design.md` §3.3. It boots a Nest HTTP app that exposes **only**
`GET /health` (so docker-compose can report it healthy, S-E0.3); it serves no
business endpoints. The queue and the database are added later, in S-E0.4 and S-E0.2.

## ESM: things to watch out for

- Relative imports must end with `.js`, even though the file is `.ts`:
  `import { AppModule } from "./app.module.js";`
- Put `import "reflect-metadata";` on the first line of `main.ts`. Nest DI needs it.
- There is no `__dirname` and no `require`. Use `import.meta.url` instead.

## Worker rules

- Order processing runs one at a time per event (concurrency = 1). Do not parallelise
  it. See `.claude/rules/concurrency.md`.
- Make job handlers idempotent: a retry must not double its effect (NFR-2).
- Background extras (fraud, email, embeddings) stay off the purchase path.
- Shared types (queue and event shapes) come from `@flash-sale/shared` — never
  redefine them here.
- Read config from env only. In code, use the variable names, not the values (NFR-8).
