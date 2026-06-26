# Technical Design Document — Flash-Sale Platform

This document describes **how** the system is built, answering the requirements in
the SRS: where the SRS says _what_ must happen (e.g. FR-15: no oversell), this says
_how_ it is achieved. References like `(FR-15)` point to the requirement a decision
satisfies. It does not repeat the requirements — see the SRS for those.

---

## 1. Architecture Overview

Three application services (self-hosted, one monorepo) and three external managed
dependencies.

Application services:

- **web** — Next.js, run as a dynamic Node server. Renders pages (SSR) and acts as
  the BFF for the browser: all client HTTP (page loads and actions like Buy) goes to
  web, which calls api server-to-server. Holds no application state. (NFR-8)
- **api** — Nest: HTTP endpoints + Socket.IO gateway. Accepts purchases (forwarded
  by web) and owns the realtime sockets. The browser connects to api **directly only**
  for the WebSocket.
- **worker** — Nest: consumes the queue, processes orders one at a time.

External managed dependencies:

- **Postgres + pgvector** (Supabase) — durable data, vector similarity for fraud
  screening, and semantic search of sales.
- **Redis** (Upstash) — atomic stock reservation, queue backend, pub/sub fan-out,
  and caching.
- **AI / email providers** — Groq (text LLM) and an email provider; both optional
  and off the purchase path.

```
                     ┌──────────────┐
                     │   browser    │
                     └──────┬───────┘
                            │  HTTP + Socket.IO (single public origin)
                            ▼
                     ┌──────────────┐
                     │    nginx     │  reverse proxy (only public entry)
                     └───┬───────┬──┘
          / (pages, buy) │       │ /socket.io (WS upgrade)
                         ▼       ▼
                   ┌─────────┐  ┌─────────┐   BullMQ job    ┌──────────┐
                   │   web   │─►│   api   │ ──────────────► │  worker  │
                   │ (Next)  │  │  (Nest) │ ◄── pub/sub ─── │  (Nest)  │
                   └─────────┘  └────┬────┘    result       └────┬─────┘
              server→server          │   (REST api: internal     │
              (SSR + buy)            │    network only)          │
                          ┌──────────┼──────────────┬───────────┤
                          ▼          ▼              ▼           ▼
                      Postgres     Redis        Redis (queue) Groq /
                     (Supabase)  (reserve +    (BullMQ)       email
                                 pub/sub +                    (optional)
                                 cache)
```

A single **nginx** reverse proxy is the only public entry (see §8): it routes page
and BFF traffic to **web** and the `/socket.io` WebSocket to **api**. So the browser
sees one origin, and the api's REST endpoints are **never exposed publicly** — web
reaches them server-side over the internal network. The Socket.IO connection is the
only browser-side path that reaches api (proxied by nginx); all other client HTTP
goes through web, which forwards Buy to api server-side and must sit next to api on
the hot path. The `api` accepts requests fast and never does heavy work inline; the
`worker` does the slow, careful work in the background. They share no in-memory
state — they communicate only through the queue and Redis pub/sub.
(NFR-3, NFR-9, NFR-10, NFR-11)

---

## 2. Repository Structure

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

---

## 3. Components & Responsibilities

### 3.1 web (Next.js)

- Renders the drop page: product, live stock, countdown, order status.
- Opens a Socket.IO connection for live stock/countdown and the result of the
  user's own order. (FR-17, FR-18)
- Reconnects automatically if the connection drops. (FR-19, NFR-4)
- Holds no authority: never decides stock, price, or permissions. (NFR-9)

### 3.2 api (Nest)

- REST endpoints: auth, view event, create event (admin), place order.
- **Socket.IO gateway** with the **Redis adapter**, so broadcasts work across
  multiple instances. (NFR-10)
- On "Buy": validates state, performs the **atomic Redis reservation**, enqueues on
  success, and responds immediately. (FR-8, FR-9, NFR-3)
- Does **not** confirm orders or talk to payment — that is the worker's job.

### 3.3 worker (Nest)

- Consumes the order queue, one job at a time per event (concurrency = 1). (FR-10)
- Runs the payment step, writes the final order state in a **Postgres transaction**,
  and releases stock on failure. (FR-11, FR-13, FR-16)
- Publishes the result to Redis pub/sub so the `api` can push it to the buyer.
- Hosts background-only jobs: fraud screening, email, sale embeddings. (FR-20,
  FR-23, FR-26, NFR-13, NFR-14)

---

## 4. Purchase Flow — the core (canonical concurrency reference)

This is the heart of the system and the **canonical explanation** of why overselling
is impossible under concurrent load. The concurrency rule and auditor point here
rather than restating the mechanism. (FR-8 to FR-16, NFR-1, NFR-3)

1. **Buyer clicks "Buy".** `web` sends an authenticated request with the event id
   and an **idempotency key** (stable per buyer+event). (FR-14)
2. **api validates** the event is `live`; if not → reject with a reason. (FR-3)
3. **api reserves stock atomically in Redis.** A single atomic op decrements the
   remaining counter only if it is above zero (Lua script or guarded `DECR`). Two
   simultaneous buyers cannot both succeed on the last unit — Redis serialises the
   operation. Below zero → **sold out**, request rejected, nothing queued. (FR-8,
   FR-15, FR-13)
4. **api creates the order row as `in_progress`** in Postgres (variant 1). The
   `UNIQUE(idempotency_key)` makes this the atomic dedup point: a double-click loses
   the race here (P2002) and releases its extra reservation. The durable row lets a
   reconnecting buyer recover "your order is processing" (FR-19). (FR-9, FR-14)
5. **api enqueues** the order in BullMQ with the idempotency key as the **job id**,
   then responds immediately: "accepted, processing". The hot path did one Redis op,
   one light INSERT and one enqueue — the slow work (payment) stays in the worker.
   (FR-9, NFR-3)
6. **worker picks up the job** and processes it, one at a time per event. (FR-10)
7. **worker runs the payment step.** Default: a simulated payment returning
   success/failure. Optional (Ext): a real provider in test mode driving the same
   outcome. (FR-11, FR-12)
8. **worker transitions the row in a Postgres transaction** (guarded by `WHERE
status = in_progress` so a re-delivered job acts at most once):
   - **success** → a guarded write (sale-row lock + `confirmed < stock_total`) sets
     `confirmed`, else `sold_out`. The lock is the final authority on stock, so the
     DB can never exceed stock_total even if Redis and the DB disagree. (FR-13, FR-15)
   - **failure** → set `failed` and **release the reserved unit** back to Redis so
     it can be sold again. (FR-11, FR-16)
9. **worker publishes the outcome** to Redis pub/sub.
10. **api relays** the result to the buyer over Socket.IO and broadcasts the new
    stock count to everyone watching the event. (FR-17, FR-18)

**Why both Redis and Postgres guard stock:** Redis gives a fast, atomic reject of
sold-out on the hot path without touching the DB; Postgres gives the durable final
guarantee inside a transaction. The two layers serve different needs — speed vs.
durability — and together close the oversell gap. (NFR-1)

---

## 5. Data Model

Postgres via **Prisma**. No separate products table; user identity is offloaded to
Auth0 with a thin `users` mirror for display and email. pgvector serves two
purposes: fraud screening (order signal embeddings) and semantic search
(sale title/description embeddings).

- **users** — `auth0_sub` (base64url-encoded Auth0 `sub`, PK), `email`,
  `name` (nullable — not guaranteed by all Auth0 providers), `created_at`. Populated
  via upsert when a buyer places their first order. Auth0 remains the identity source
  of truth; this table caches only what the app needs locally (display name for fraud
  flags, email address for transactional email FR-23).
- **sales** — `id`, `title`, `description`, `stock_total`, `price_cents`,
  `starts_at`, `ends_at`, `created_at`, `embedding vector` _(Ext)_. Product details
  live directly on the sale row — there is no separate products table. The embedding
  is computed in the background from `title` + `description` and used for semantic
  search. State (upcoming/live/ended) is derived, not
  stored. (FR-1, FR-2)
- **orders** — `id`, `sale_id`, `buyer_id` (base64url-encoded Auth0 `sub`),
  `idempotency_key` (unique per buyer+sale), `status` (in*progress | confirmed |
  sold_out | failed), `payment_ref` *(Ext)\_, `acknowledged_at`, `created_at`. api
  writes `in_progress` before enqueue; the worker transitions it to exactly one
  terminal status. The unique key enforces idempotency at the DB level too.
  `acknowledged_at` is set when the buyer confirms receipt of the result; subsequent
  reconnect snapshots are suppressed once it is set. (FR-14, FR-19)
- **fraud_flags** _(Ext)_ — `id`, `order_id`, `buyer_id`, `sale_id`, `risk`,
  `reason`, `pattern`, `embedding vector`, `status` (open | reviewed),
  `created_at`, `reviewed_at`. (FR-22)

Authoritative stock lives in Postgres (`stock_total` minus confirmed orders). The
Redis counter is a fast working copy for the hot path; the database is the source of
truth.

---

## 6. Real-Time Design

- **Socket.IO** for browser connections, with the **Redis adapter** so broadcasts
  reach clients regardless of which `api` instance they hit. (NFR-10)
- The `worker` never touches sockets: it publishes results to Redis pub/sub, and the
  `api` (which owns the sockets) relays them. This keeps the worker free of
  connection state.
- Clients reconnect and, on reconnect, re-fetch current event state, so a dropped
  connection never leaves stale data. (FR-19)

---

## 7. Background Jobs (Ext)

All optional features are background jobs in the worker, off the purchase path, so
the core flow works fully without them. (NFR-13)

- **Fraud screening** — after order creation: gather signals → embed them locally
  (transformers.js) → vector similarity search (pgvector) for known patterns → Groq
  scores risk → if risky, Groq drafts a reviewer note → store a `fraud_flag`. Per
  order, never on a stream, to respect Groq's rate limits. (FR-20–22)
- **Email** — a separate job type, sent with retries and idempotency (one email per
  outcome); a failed provider call is retried with backoff. (FR-23–25, NFR-6)
- **Sale embeddings** — computed locally (transformers.js / ONNX) from `title` +
  `description`, stored as a pgvector column on the sale row. Run lazily in the
  background, one at a time, so the VM is never blocked. Powers semantic search
  (FR-26). (NFR-14)

---

## 8. Deployment

- **nginx**, **web**, **api**, and **worker** all run on a **GCP e2-micro** VM via
  `docker-compose`.
- Stateful services are external managed dependencies: Postgres/pgvector on
  Supabase, Redis on Upstash. Only the three Node processes (web, api, worker) and a
  lightweight nginx (~10 MB) run on the VM, so ~1 GB RAM is enough. (NFR-15)
- **web** runs as a dynamic Next.js Node server, **co-located with api** (same VM):
  it SSRs pages and proxies all client HTTP — including the Buy hot path — to api,
  so it must sit next to api to keep that hop cheap. It holds no application state.
  (NFR-3)
- **nginx** is the single public entry (reverse proxy): `/socket.io` → api (with WS
  upgrade), everything else → web. The api's REST endpoints are **not** exposed
  publicly — web reaches them over the internal docker network. One browser origin,
  and api's HTTP surface stays private. (NFR-9)
- Secrets come from environment configuration, never the repo. (NFR-8)
- A swap file on the VM is a safety margin against OOM during install/build.

---

## 9. Key Decisions & Trade-offs

- **Stock correctness: Redis + queue + Postgres.** Mechanism in §4. In short: three
  layers for three needs — Redis for a fast atomic reject on the hot path, the queue
  to remove parallelism during finalisation, Postgres for the durable guarantee.
  Most moving parts of any option; Postgres-only would suffice for tiny real load,
  but demonstrating the correct concurrent design is the point. (NFR-1, FR-10, FR-15)
- **Queue: BullMQ.** Runs on the Redis already present, so no new infrastructure;
  gives retries, backoff, delays, and concurrency control out of the box. Tied to
  Redis and not a general-purpose broker — RabbitMQ/Kafka would be the answer only
  at far larger scale. (NFR-11)
- **Real-time: Socket.IO + Redis adapter.** Reconnection, rooms, and cross-instance
  broadcasting are built in — the hard parts, solved. Heavier than raw `ws`; SSE or
  `ws` would be leaner if updates were one-way from one instance. (NFR-4, NFR-10)
- **ORM: Prisma.** Strong type-safety, clean migrations, broad support (incl.
  pgvector), and AI tools handle it well. The cost — explicit locking / guarded
  updates need `$queryRaw` — is small, since those concurrency-critical spots are
  hand-written and hand-verified anyway.
- **One Postgres + pgvector, not a second database.** Both vector use cases (fraud
  screening and semantic search) live in the same DB already present — no extra
  infrastructure, no cross-store consistency problem.
- **Sockets on a VM, not Cloud Run.** On Cloud Run an open WebSocket keeps an
  instance active (billed, won't scale to zero), connections face a request timeout
  and best-effort affinity, and a queue-consuming worker wants to run continuously.
  A small always-on VM avoids all of this for short-lived drop sessions. At larger
  scale the answer flips to Cloud Run + the Socket.IO Redis adapter. (NFR-4, NFR-10)
- **Fake payment by default, real provider (test mode) as an extension.** The hard
  problem is concurrency, not payments; a simulated step exercises the flow, and
  test-mode Stripe slots in later behind the same outcome contract. (FR-11, FR-12)
- **Monorepo with a shared contract package.** Keeps the queue job/event types in
  sync between api and worker in one place; pnpm workspaces, no heavy orchestrator
  needed at this size.
