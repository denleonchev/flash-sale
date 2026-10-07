# 3. Components & Responsibilities

## 3.1 web (Next.js)

- Renders the drop page: product, live stock, countdown, order status.
- Opens a Socket.IO connection for live stock/countdown and the result of the
  user's own order. (FR-17, FR-18)
- Reconnects automatically if the connection drops. (FR-19, NFR-4)
- Holds no authority: never decides stock, price, or permissions. (NFR-9)

## 3.2 api (Nest)

- REST endpoints: auth, view event, create event (admin), place order.
- **Socket.IO gateway** with the **Redis adapter**, so broadcasts work across
  multiple instances. (NFR-10)
- On "Buy": validates state, performs the **atomic Redis reservation**, enqueues on
  success, and responds immediately. (FR-8, FR-9, NFR-3)
- Does **not** confirm orders or talk to payment — that is the worker's job.

## 3.3 worker (Nest)

- Consumes the order queue, one job at a time per event (concurrency = 1). (FR-10)
- Runs the payment step, writes the final order state in a **Postgres transaction**,
  and releases stock on failure. (FR-11, FR-13, FR-16)
- Publishes the result to Redis pub/sub so the `api` can push it to the buyer.
- Hosts background-only jobs: fraud screening, email, sale embeddings. (FR-20,
  FR-23, FR-26, NFR-13, NFR-14)
