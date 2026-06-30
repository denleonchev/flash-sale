# Flash Sale Platform

Flash sales: limited stock, many buyers at once. The system must confirm exactly K orders out of N concurrent requests — no overselling, no duplicates.

**Live demo:** https://flash.bonadev.xyz

Two browser windows, two different buyers, same sale. One buys — `remaining` drops in both windows at the same instant, in real time:

https://github.com/user-attachments/assets/2fd521e9-742a-42a6-a6a6-5499e5ed1556

---

## The problem

200 buyers click "Buy" in the same second, 5 items available. A naive `SELECT stock` → check in code → `UPDATE stock - 1` is a real bug: two requests can read 5 before either writes back, so both think a unit is free and both decrement — oversell. Locking the row (`SELECT ... FOR UPDATE`) fixes the bug, but now all 200 requests queue on that one lock and hold a DB connection while they wait — correct, but a bottleneck under a spike. This project solves both: no oversell, and the hot path stays fast.

---

## How overselling is prevented

Three layers, each for a different reason:

**1. Atomic Redis reservation** — on "Buy", a Lua script checks and decrements stock in one atomic step. Redis is single-threaded, so two buyers cannot both win the last unit.

```lua
-- stock.repository.ts
if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end
local stock = tonumber(redis.call('GET', KEYS[1]))
if not stock or stock < tonumber(ARGV[1]) then return 0 end
redis.call('DECRBY', KEYS[1], tonumber(ARGV[1]))
return 1
```

**2. Queue with concurrency = 1** — reserved orders go into BullMQ. The worker processes them one at a time. No parallelism, no race.

**3. Postgres transaction with SELECT FOR UPDATE** — the worker locks the sale row and counts confirmed orders before writing the final status. The DB cannot go below zero even if Redis and Postgres disagree.

```typescript
// worker/src/orders/orders.repository.ts
const rows = await tx.$queryRaw`SELECT stock_total FROM sales WHERE id = ${saleId} FOR UPDATE`;
const confirmedCount = await tx.order.count({ where: { saleId, status: "confirmed" } });
const targetStatus = confirmedCount < stockTotal ? "confirmed" : "sold_out";
```

The API does write an `in_progress` order row and call Stripe on "Buy" — but the contention-prone step, deciding confirmed vs sold_out under `SELECT FOR UPDATE`, happens later in the worker, after the Stripe webhook. The Redis gate is what makes the sold-out decision instant and keeps that contention off the request path.

---

## Architecture

```
Browser
      │
   Caddy (TLS, reverse proxy)
      │
      ├── /socket.io/ ──────────────────► API (Nest.js)
      │                                        │
      └── /           ──►  Web (Next.js) ──► API (Nest.js)
                            (SSR + BFF)        │
                                    ┌──────────┴──────────┐
                                    │         │           │
                                 Postgres   Redis       BullMQ
                                (orders,   (stock,    (order jobs)
                                 users)    pub/sub)
                                                         │
                                                    Worker (Nest.js)
                                                    (processes orders,
                                                     fraud screening,
                                                     embeddings)
```

- **API** — takes purchase requests, runs Redis reservation, enqueues jobs, owns WebSocket connections
- **Worker** — processes orders one at a time, runs Stripe capture, fraud screening
- **Web** — Next.js frontend, live stock via Socket.IO

Postgres and Redis are external managed services (Supabase, Upstash), so the app services fit on a 1 GB VM.

---

## Real-time

Worker publishes results to Redis pub/sub → API subscribes and pushes to clients via Socket.IO with the Redis adapter. On reconnect, the client re-subscribes and gets a current snapshot.

---

## Payment (Stripe authorize/capture)

1. API creates a PaymentIntent with `capture_method: manual` — reserves funds, no charge yet
2. Buyer completes 3DS if needed
3. Stripe sends `payment_intent.amount_capturable_updated` webhook
4. Webhook handler enqueues a capture job
5. Worker decides: stock available → capture + confirmed / no stock → cancel PI + sold_out

Buyer is never charged for something they didn't get.

---

## Idempotency

- `UNIQUE` on `idempotency_key` — DB-level dedup; double-click loses the INSERT race on P2002, API cancels the extra PI and releases the Redis unit
- BullMQ job ID = `orderId` — duplicate webhook is a no-op
- `UPDATE ... WHERE status = in_progress` — job retries are safe

---

## Fraud screening

After an order reaches `confirmed` or `sold_out` in the capture flow, a background job runs independently of the purchase flow:

1. Collects buyer activity over the last 60 min
2. Embeds the activity pattern locally (`all-MiniLM-L6-v2` via transformers.js)
3. Finds similar past cases in Postgres via pgvector cosine similarity
4. Sends pattern + similar cases to Groq (LLaMA) for risk classification
5. Medium / high risk → creates a `fraud_flag` for moderator review

If Groq is rate-limited or the model is unavailable, the purchase flow is not affected.

---

## Concurrency test

```
CONCURRENCY_STOCK=5 CONCURRENCY_BUYERS=50 \
  pnpm --filter @flash-sale/db test:integration:stripe-concurrency
```

Seeds a live sale, fires 50 concurrent buy requests, posts all webhooks at once (this exercises `SELECT FOR UPDATE`), waits for settlement, asserts:

```
confirmed == 5
confirmed + sold_out + failed == accepted
```

---

## Stack

|               |                                                            |
| ------------- | ---------------------------------------------------------- |
| Frontend      | Next.js, TypeScript, Tailwind                              |
| API / Worker  | Nest.js, TypeScript, BullMQ, Socket.IO                     |
| Database      | PostgreSQL + pgvector (Supabase)                           |
| Cache / queue | Redis (Upstash) + BullMQ                                   |
| Auth          | Auth0                                                      |
| Payments      | Stripe (authorize/capture)                                 |
| AI            | Groq (LLaMA), transformers.js                              |
| Deploy        | GCP e2-micro, Docker Compose, Caddy, GitHub Actions → GHCR |

---

## Structure

```
flash-sale/
├── apps/
│   ├── api/      HTTP + Socket.IO
│   ├── worker/   order processing, fraud, embeddings
│   └── web/      Next.js frontend
└── packages/
    ├── shared/   queue job types, socket events, enums (imported by api and worker)
    └── db/       Prisma schema, migrations, integration tests
```

---

## Why these choices

**Redis + queue + Postgres instead of Postgres-only?**
Postgres with `SELECT FOR UPDATE` is correct but puts all contention on the DB during the spike. Redis gives a fast atomic gate on the hot path. The queue removes parallelism during finalisation. Postgres is the durable last check. Postgres-only would be fine for small real load — this design is chosen to demonstrate the right architecture for the problem.

**VM instead of Cloud Run?**
Open WebSockets keep Cloud Run instances billed and face request timeouts. A queue worker wants to run continuously. A small always-on VM fits better. At scale the answer flips: Cloud Run + Socket.IO Redis adapter.

**BullMQ instead of RabbitMQ?**
Redis is already there. BullMQ runs on top of it — retries, backoff, concurrency control, no extra infrastructure.
