# 3. Components & Responsibilities

## 3.1 web (Next.js)

- Renders the drop page: product, live stock, countdown, order status.
- Opens a Socket.IO connection for live stock/countdown and the result of the
  user's own order. (FR-17, FR-18)
- Reconnects automatically if the connection drops. (FR-19, NFR-4)
- Holds no authority: never decides stock, price, or permissions. (NFR-9)
- Describes public pages to search engines: per-page metadata and canonical
  address, `sitemap.xml`, `robots.txt`, and structured data (JSON-LD) on the sale
  page. All of it is built from the same api responses the pages use. (FR-31,
  FR-32, FR-33)
- The sale address is `/sales/<slug>-<id>`. The slug is computed from the title and
  is not stored; the ID alone identifies the sale, and any other form of the address
  redirects to the current one. (FR-35)

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

## 3.4 Domain modules

Shared by `api` and `worker`. Extracted one at a time; until a module exists, its
logic still lives in the hosts.

| Module      | Public interface                                                                     | Owns                                          |
| ----------- | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| `inventory` | reserve, release                                                                     | the Redis stock counter, its scripts, reseed  |
| `payments`  | create, read status, capture, cancel a payment; verify a webhook signature           | the payment provider client                   |
| `orders`    | create an order, move it out of `in_progress`, find a buyer's order, list stale ones | the `orders` table and the order result event |

Catalog (sales) and fraud screening stay in their hosts: each runs in one process
only, so there is nothing to share.
