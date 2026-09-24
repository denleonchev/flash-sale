# Flash Sale Platform

Flash sales: limited stock, many buyers at once. The system must confirm exactly K orders out of N concurrent requests — no overselling, no duplicates.

**Live demo:** https://flash.bonadev.xyz — "Try demo account" opens a ready-made buyer, no sign-up. Switch to Moderator or Admin from the bar at the bottom to see fraud flags and create a sale.

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

**2. Queue between the gate and the DB** — reserved orders go into BullMQ. Only winners get here: the Redis gate already turned everyone else away at "Buy", so the queue holds on the order of K jobs, not N. The worker currently runs them one at a time (`concurrency: 1`), which makes processing deterministic — but correctness does not depend on it. See [Ordering and fairness](#ordering-and-fairness).

**3. Postgres transaction with SELECT FOR UPDATE** — the worker locks the sale row and counts confirmed orders before writing the final status. `SELECT FOR UPDATE` serialises concurrent capture jobs for the same sale — at any worker concurrency. The DB cannot go below zero even if Redis and Postgres disagree.

```typescript
// worker/src/orders/orders.repository.ts
const rows = await tx.$queryRaw`SELECT stock_total FROM sales WHERE id = ${saleId} FOR UPDATE`;
const confirmedCount = await tx.order.count({ where: { saleId, status: "confirmed" } });
const targetStatus = confirmedCount < stockTotal ? "confirmed" : "sold_out";
```

The API does write an `in_progress` order row and call Stripe on "Buy" — but the contention-prone step, deciding confirmed vs sold_out under `SELECT FOR UPDATE`, happens later in the worker, after the Stripe webhook. The Redis gate is what makes the sold-out decision instant and keeps that contention off the request path.

---

## Ordering and fairness

The capture job is not enqueued by the purchase request. It is enqueued by the Stripe webhook, and between the Redis `DECRBY` and the queue sit `confirmCardPayment()` and, when the bank asks for it, a 3DS challenge.

So FIFO in the queue is the order in which payments were confirmed, not the order in which people clicked. Clicks in a drop are milliseconds apart; the payment side spreads them over seconds.

Which means `concurrency: 1` buys reproducibility of someone else's ordering, not fairness. Stated plainly: the fastest payment wins, not the fastest click. For a flash sale that is defensible — the payment is authorised, the funds are held, the buyer is real.

The only place where click order still exists is the single-threaded Lua script. If fairness ever has to become a property of the system, the rank is taken there — an `INCR` next to the `DECRBY` — and the processing order stops meaning anything.

Processing order only decides which of the extra orders becomes `sold_out` when Redis and Postgres disagree — a recovery path where any tie-break is equally arbitrary. It never affects the confirmed count.

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
                                                    (capture jobs,
                                                     fraud screening,
                                                     embeddings)
```

- **API** — takes purchase requests, runs Redis reservation, enqueues jobs, owns WebSocket connections
- **Worker** — processes capture jobs, runs Stripe capture, fraud screening
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
3. Finds similar past cases in Postgres via pgvector (L2 distance — embeddings are normalised, so L2 and cosine rank identically)
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

## Known limits and scaling path

`concurrency: 1` is global, not per sale: one busy drop delays the capture jobs of every other sale.

`capturePI()` is a network call inside the job — it runs after the transaction commits, but still on the queue's critical path, so the ceiling is Stripe's latency rather than the database.

Raising the concurrency runs first into the confirmed-count read under the row lock, which is why `orders(sale_id, status)` carries an index. After that, in order: the Supabase connection pool, Stripe's rate limits (BullMQ's `limiter` is the lever), and CPU contention with the local embedding jobs on a single e2-micro.

Serialising per sale without giving up parallelism, if it is ever needed: `hash(saleId) % M` queues, each with `concurrency: 1`. The same guarantee per sale, M sales in flight, no BullMQ Pro licence.

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

## Migrations

Prisma has no representation for pgvector's `hnsw` index type, so both vector indexes live in a hand-written migration and are invisible to Prisma's schema diff — `migrate dev` generates a `DROP INDEX` for them, and has already done so once. New schema migrations are therefore created with `--create-only` (`pnpm migrate:new`), that line is stripped, and they are applied with `migrate deploy`, which never diffs the schema and so cannot generate a drop of its own.

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
Postgres with `SELECT FOR UPDATE` is correct but puts all contention on the DB during the spike. Redis gives a fast atomic gate on the hot path. The queue removes the Stripe round-trip from the request path. Postgres is the durable last check. Postgres-only would be fine for small real load — this design is chosen to demonstrate the right architecture for the problem.

**VM instead of Cloud Run?**
Open WebSockets keep Cloud Run instances billed and face request timeouts. A queue worker wants to run continuously. A small always-on VM fits better. At scale the answer flips: Cloud Run + Socket.IO Redis adapter.

**BullMQ instead of RabbitMQ?**
Redis is already there. BullMQ runs on top of it — retries, backoff, concurrency control, no extra infrastructure.

**Why a queue at all, if Redis already decides?**
Redis is the fast gate on the hot path. The queue takes the capture and the Stripe round-trip off the request path and adds retries with backoff. Postgres is the last durable check. What the queue does _not_ give is the ordering guarantee people intuitively expect from it — see [Ordering and fairness](#ordering-and-fairness).
