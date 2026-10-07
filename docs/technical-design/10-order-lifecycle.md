# 10. Order Lifecycle — unfinished orders and reserved stock

Continues [4. Purchase Flow](04-purchase-flow.md): what the system does with an order
that is still `in_progress`, and how reserved units are accounted for. The concurrency
reasoning in each section is canonical for that code, like §4 is for the purchase flow.

## Reconciliation of unfinished orders (FR-28)

With the real payment provider an order leaves `in_progress` only when a provider
event arrives. If the buyer abandons the checkout, or an event is lost, the order
would hold its reserved unit forever. A repeatable worker job closes that gap: once
a minute it takes orders that have been `in_progress` longer than
`ORDER_RECONCILE_AFTER_MINUTES` (default 2), reads the PaymentIntent status from the
provider and finalizes the order:

| PaymentIntent status                       | Action                                             |
| ------------------------------------------ | -------------------------------------------------- |
| `requires_capture`                         | enqueue the capture job, as the webhook would      |
| `requires_confirmation`, `requires_action` | order → `expired`, release the unit, cancel the PI |
| `requires_payment_method`                  | order → `failed`, release the unit, cancel the PI  |
| `canceled`                                 | order → `failed`, release the unit                 |
| `processing`                               | leave it, check again on the next run              |
| `succeeded`                                | leave it, log an error — needs a human             |

**Why it is safe under concurrent access:**

- Reconciliation competes with the failure webhook (api) and the capture job
  (worker). All three change the order with `UPDATE ... WHERE status = in_progress`,
  so exactly one of them makes the transition.
- Only the party whose transition took effect releases the unit — never twice.
- The order row is updated **before** the PI is cancelled. Cancelling first could let
  the capture job write `confirmed` and then fail to capture a cancelled PI.
- If the buyer pays at the very moment the order expires, the order stays `expired`
  and cancelling the PI releases the hold. The cancel is a single call; if it fails
  the error is logged and the hold lapses when the authorization expires.
- A crash between the status write and the unit release leaves that unit stuck
  (under-count, never oversell) — the same window the failure webhook has.
- Reconciliation never writes `confirmed`. The sale-row lock in the capture job
  stays the only authority on stock. (FR-15)

It runs on its own queue so provider calls never delay capture jobs.

## Closing an unfinished order on page load (FR-29)

Waiting for the scheduled run leaves a buyer who reloaded the page mid-payment
looking at "Processing…" for minutes. Reloading discards the card form and any 3DS
window, so a request for the sale page is treated as the buyer giving up on a payment
that has not been authorized yet.

When the sale page mounts in the browser for a signed-in buyer, `web` calls
`POST /orders/abandon` (through a server action, so the buyer id comes from the session).
If the buyer has an `in_progress` order for that sale, `api` enqueues a
`reconcile-order` job carrying that order's id on the reconciliation queue. The worker
runs the same decision table as above for that one order, ignoring its age. The call
returns once the job is enqueued — the page is not held while the provider is queried —
and the buyer gets the outcome over Socket.IO.

- An authorized payment (`requires_capture`) is **not** abandoned: the capture job is
  enqueued and the order ends `confirmed` or `sold_out` as usual.
- The trigger is the page mounting in the browser. Not a server render — Next re-renders
  the route after server actions too, including the buy action itself — and not a socket
  reconnect, which also happens on a network blip. Either would cancel a payment that is
  still inside 3DS.
- Buy stays disabled until the call returns, so the check can never hit an order created
  from the same page.
- Opening the sale in a second tab or on another device is indistinguishable from a
  reload and cancels the payment in the first one. Accepted: no money is lost.

**Why it is safe under concurrent access:** it adds no new transition. The job goes
through the same `UPDATE ... WHERE status = in_progress` and competes with the
scheduled run, the failure webhook and the capture job on the same terms — one of them
transitions the order. The job names one order id, resolved when the page was
requested, so an order the buyer creates afterwards is never touched; and while the
old order is still `in_progress`, `api` does not create a new one for that buyer.

## Reserved vs sold (FR-30)

A unit can be **sold** (order `confirmed`) or **reserved** (order `in_progress`: taken
in Redis, not paid yet). The Redis counter holds what can be bought right now:
`stock_total − sold − reserved`.

- **Rebuilding the counter.** When the Redis key is missing (restart, eviction), the
  first reservation seeds it from Postgres as `stock_total − sold − reserved`. Seeding
  `stock_total − sold` would hand reserved units out a second time; the capture job
  would still refuse the extra buyers, but only after their cards were authorized.
- **Releasing a unit never creates the key.** A release is "increment if the key
  exists". A plain `INCRBY` on a missing key would create it with the value 1 and block
  the rebuild, leaving the sale with one unit. Skipping is safe because the order row is
  always updated before the release: the next rebuild no longer counts that order as
  reserved.
- **Rejection text.** If the reservation fails while `sold < stock_total`, the buyer is
  told every unit is being checked out and may come back; only `sold = stock_total` is
  "sold out".

**Under concurrent access:** nothing changes on the reservation itself — it is still
one atomic Lua call. Two accepted gaps, both under-counts that the sale-row lock in the
capture job turns into "one unit sold late or not at all", never an oversell:

- Between the Redis reservation and the order INSERT (the provider call sits in
  between) the unit is reserved with no row. A key lost in that window is rebuilt one
  unit too high.
- An order closed between the rebuild's read and its `SET NX` is counted as reserved
  while its release finds no key: the counter stays one unit too low.
