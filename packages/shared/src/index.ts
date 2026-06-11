/**
 * @flash-sale/shared — the single contract between `api` (producer) and
 * `worker` (consumer). Every shared type lives here and is imported by both
 * services so the queue producer and consumer cannot drift apart. (NFR-10)
 *
 * See docs/technical-design.md §4 (Purchase Flow) and §5 (Data Model) for the
 * authoritative definitions these types mirror.
 */

/**
 * Lifecycle of an order. Mirrors the `orders.status` column in §5.
 * - `pending`   — reserved + enqueued, not yet processed by the worker.
 * - `confirmed` — worker committed the order in a Postgres transaction.
 * - `sold_out`  — reservation failed; stock was exhausted.
 * - `failed`    — payment failed; the reserved unit was released.
 */
export type OrderStatus = "pending" | "confirmed" | "sold_out" | "failed";

/**
 * Payload of the BullMQ order job. The `api` enqueues this after a successful
 * atomic Redis reservation (§4 step 4); the `worker` consumes it (§4 step 6).
 * The job id is the `idempotencyKey`, so duplicate requests collapse to one job.
 */
export interface OrderJobPayload {
  /** Sale (drop) the order belongs to. */
  saleId: string;
  /** Buyer placing the order. */
  buyerId: string;
  /** Stable per buyer+sale; used as the BullMQ job id for idempotency. (FR-14) */
  idempotencyKey: string;
  /** Units requested. Reserved atomically in Redis before enqueue. */
  quantity: number;
}

/**
 * Result the `worker` publishes to Redis pub/sub after processing a job; the
 * `api` relays it to the buyer over Socket.IO (§4 steps 9–10).
 */
export interface OrderResult {
  /** Echoes the job's idempotency key so the api can route the result. */
  idempotencyKey: string;
  /** Terminal status of the processed order. */
  status: OrderStatus;
  /** Stock remaining for the sale after processing, for the live broadcast. */
  remainingStock: number;
}