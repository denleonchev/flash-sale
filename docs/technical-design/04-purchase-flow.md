# 4. Purchase Flow — the core (canonical concurrency reference)

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

What happens to an order that does not reach a final state on its own —
reconciliation, closing on page load, reserved vs sold stock — is in
[10. Order Lifecycle](10-order-lifecycle.md).
