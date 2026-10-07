# 2. Repository Structure

A single monorepo managed with **pnpm workspaces**.

```
flash-sale/
├─ pnpm-workspace.yaml
├─ package.json
├─ docker-compose.yml
├─ apps/
│  ├─ web/        Next.js frontend
│  ├─ api/        Nest — HTTP API + Socket.IO gateway
│  └─ worker/     Nest — order processor / background jobs
└─ packages/
   └─ shared/     shared types: DTOs, queue job/event contracts, enums
```

`packages/shared` holds the **contract** between `api` and `worker` — the queue job
shape and the order/event types. Both services import the same definitions, so
producer and consumer cannot drift. This is the main reason for a monorepo over
separate repositories.
