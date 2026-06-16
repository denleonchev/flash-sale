# CLAUDE.md — apps/api (Nest)

This file adds rules only for api. The root `CLAUDE.md` and `.claude/rules/*`
(boundaries, concurrency, scope-discipline, coding-style) still apply. Do not repeat
them here.

## What this service is

Nest HTTP API, and later a Socket.IO gateway. It answers requests fast and does no
slow work itself — see `docs/technical-design.md` §3.2. The queue and the database are
added later, in S-E0.2 and S-E0.4.

## ESM: things to watch out for

- Relative imports must end with `.js`, even though the file is `.ts`:
  `import { AppModule } from "./app.module.js";`
- Put `import "reflect-metadata";` on the first line of `main.ts`. Nest DI needs it.
- There is no `__dirname` and no `require`. Use `import.meta.url` instead.

## Structure and style

- One feature is one folder `src/<feature>/` with `*.module.ts`, `*.controller.ts`,
  `*.service.ts`, and `*.repository.ts` (when the feature touches the DB).
- Keep controllers small: check the input and call a service. Put the real logic in
  services.
- Always validate input DTOs (`class-validator`). Do not trust the client (NFR-9).
- Shared types (DTOs, queue and event shapes) come from `@flash-sale/shared`. Do not
  write them again here.
- Read config from env only. In code, use the variable names, not the values (NFR-8).

## Layered architecture

Strict layer order — never skip a layer:

```
Controller → Service → Repository → PrismaService
```

- **Controller**: input validation only, delegates to Service.
- **Service**: business logic. Never imports `PrismaService` directly.
- **Repository**: all `prisma.db.*` calls live here, nowhere else. Returns raw Prisma
  rows; no business logic.
- **PrismaService**: DB connection wrapper (`src/db/`). Injected only into repositories.

Violating this (e.g. a service calling `prisma.db.*` directly) was a real bug in S-2.4:
it bypassed the layer and made the pattern inconsistent. Add a repository instead.
