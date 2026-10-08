# 2. Repository Structure

A single monorepo managed with **pnpm workspaces**.

```
flash-sale/
├─ pnpm-workspace.yaml
├─ package.json
├─ docker-compose.yml
├─ apps/                hosts — transport only
│  ├─ web/              Next.js frontend
│  ├─ api/              Nest — HTTP API + Socket.IO gateway
│  └─ worker/           Nest — queue processors / background jobs
├─ packages/            shared infrastructure
│  ├─ shared/           contracts: DTOs, queue job/event shapes, enums
│  ├─ db/               Prisma schema, migrations, generated client
│  ├─ telemetry/        tracing and logging setup
│  └─ telemetry-gcp/    GCP exporters
└─ modules/             domain modules
   ├─ inventory/        stock
   ├─ payments/         payment provider (planned)
   └─ orders/           orders           (planned)
```

`packages/shared` holds the **contract** between `api` and `worker` — the queue job
shape and the order/event types. Both services import the same definitions, so
producer and consumer cannot drift. This is the main reason for a monorepo over
separate repositories.

## Hosts and domain modules

`api` and `worker` are two processes over one database and one Redis. Business logic
that both need lives in a **domain module** — a package under `modules/` with one
public entry point — so each rule exists once. What each module owns is listed in
[§3.4](03-components.md).
