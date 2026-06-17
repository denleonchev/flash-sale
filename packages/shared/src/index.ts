/**
 * @flash-sale/shared — the single contract between `api` (producer) and
 * `worker` (consumer). Every shared type lives here and is imported by both
 * services so the queue producer and consumer cannot drift apart. (NFR-10)
 *
 * See docs/technical-design.md §4 (Purchase Flow) and §5 (Data Model) for the
 * authoritative definitions these types mirror.
 */

/**
 * Terminal lifecycle states of an order. Mirrors the `orders.status` column in §5.
 * - `confirmed` — worker committed the order in a Postgres transaction.
 * - `sold_out`  — guarded Postgres write found no remaining stock (arrives in S-4.1).
 * - `failed`    — payment failed; the reserved unit was released (arrives in S-4.2).
 *
 * Defined as `as const` array so web can pass it directly to `z.enum(ORDER_STATUSES)`
 * and Prisma queries can spread it into `{ in: [...ORDER_STATUSES] }`. (memory: constants-over-literals)
 */
export const ORDER_STATUSES = {
  CONFIRMED: "confirmed",
  SOLD_OUT: "sold_out",
  FAILED: "failed",
} as const;

export type OrderStatus = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES];

/** All order status values as a tuple — for `z.enum(ORDER_STATUS_VALUES)` and Prisma `{ in: [...] }`. */
export const ORDER_STATUS_VALUES = Object.values(ORDER_STATUSES) as [OrderStatus, ...OrderStatus[]];

/**
 * BullMQ queue and job names. Shared so the api producer and the worker consumer
 * agree on the exact strings and cannot drift apart. (NFR-11)
 * - `ORDER_QUEUE` — the single queue that decouples request handling from order
 *   processing (§3.2/§3.3).
 * - `ORDER_JOB` — the job name added to that queue.
 */
export const ORDER_QUEUE = "orders";
export const ORDER_JOB = "process-order";

/**
 * Socket.IO wire contract, shared so the api gateway and any client agree on event
 * names and room layout. Cross-instance fan-out is handled by the Redis adapter so
 * a broadcast reaches a client whichever api instance it is connected to. (NFR-10)
 */
export const SOCKET_EVENTS = {
  /** Client → server command: follow one sale, i.e. join its room. (FR-17, FR-19) */
  SALE_SUBSCRIBE: "sale:subscribe",
  /** Server → clients event: the sale's remaining stock changed. (FR-17) */
  SALE_STOCK_UPDATED: "sale:stock:updated",
  /** Server → client (private room) event: the buyer's own order result. (FR-18) */
  ORDER_RESULT_UPDATED: "order:result:updated",
} as const;

/** The room id a client joins to receive live updates for one sale. */
export function getSaleRoomId(saleId: string): string {
  return `sale:${saleId}`;
}

/** The private room id an authenticated buyer is placed in on connect. (FR-18) */
export function getUserRoomId(buyerId: string): string {
  return `user:${buyerId}`;
}

/**
 * Redis pub/sub channels shared between `worker` (publisher) and `api` (subscriber).
 * - `STOCK` — post-confirm remaining stock; body: `SaleStockUpdatedPayload`. (FR-17, NFR-10)
 * - `ORDER_RESULT` — per-buyer order result; body: `OrderResult`. (FR-18, NFR-10)
 */
export const REDIS_CHANNELS = {
  STOCK: "stock:updates",
  ORDER_RESULT: "order:results",
} as const;

/** Payload broadcast on `SOCKET_EVENTS.SALE_STOCK_UPDATED`. */
export interface SaleStockUpdatedPayload {
  saleId: string;
  remainingStock: number;
}

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
  /**
   * Stable per buyer+sale; used verbatim as the BullMQ job id for idempotency
   * (FR-14). BullMQ forbids ':' in custom job ids (it is its Redis key
   * separator), so this key must stay url-safe (letters, digits, '-', '_'). A
   * future composite key that needs ':' should be hashed before becoming a jobId.
   */
  idempotencyKey: string;
  /** Units requested. Reserved atomically in Redis before enqueue. */
  quantity: number;
}

/**
 * Result the `worker` publishes to `ORDER_RESULT_CHANNEL` after processing a job;
 * the `api` routes it to the buyer's private socket room. (FR-18, §4 steps 9–10)
 */
export interface OrderResult {
  /** Used by the api to route the event to the buyer's private room. */
  buyerId: string;
  /** Context for the client — which sale this result belongs to. */
  saleId: string;
  /** Terminal status of the processed order. */
  status: OrderStatus;
}

/** Payload of the `SOCKET_EVENTS.ORDER_RESULT_UPDATED` event (server → client). (FR-18) */
export interface OrderResultUpdatedPayload {
  saleId: string;
  status: OrderStatus;
}

/**
 * Canonical sale state values (FR-2). Never stored — computed from time + stock.
 * - `upcoming` — before `startsAt`.
 * - `live`     — between start and end, stock remaining.
 * - `ended`    — after `endsAt`, or stock exhausted ("sold out" collapses here).
 */
export const SALE_STATES = {
  UPCOMING: "upcoming",
  LIVE: "live",
  ENDED: "ended",
} as const;

/** Derived state of a sale (event), auto-inferred from `SALE_STATES`. */
export type SaleState = (typeof SALE_STATES)[keyof typeof SALE_STATES];

/**
 * Derives the current state of a sale from its schedule and remaining stock (FR-2).
 * Pure function — no I/O, testable in isolation. `now` is passed in so callers
 * (api response, S-5.2 checks) control the clock without mocking Date.
 *
 * Serialisability note: `startsAt`/`endsAt` accept `Date` so the api can pass
 * Prisma `DateTime` fields directly without conversion.
 */
export function deriveSaleState(
  sale: { startsAt: Date; endsAt: Date; remainingStock: number },
  now: Date,
): SaleState {
  if (now < sale.startsAt) return SALE_STATES.UPCOMING;
  if (now >= sale.endsAt || sale.remainingStock <= 0) return SALE_STATES.ENDED;
  return SALE_STATES.LIVE;
}

/**
 * What the buyer sees for one sale (FR-5): the api response of `GET /sales/:id`,
 * consumed by `web`. `Dto` = a shape that crosses the client↔server boundary.
 * This is a pure type contract: `web` validates it at runtime with a Zod schema,
 * `api` constructs it — neither library lives here (shared stays framework-agnostic).
 */
export interface SaleDto {
  id: string;
  title: string;
  state: SaleState;
  /** Units still available (stockTotal minus confirmed orders, §5). */
  remainingStock: number;
  /** ISO-8601 timestamps so the payload is JSON-serialisable. */
  startsAt: string;
  endsAt: string;
  /** Server clock at response time; anchors the client countdown (no clock skew). */
  serverNow: string;
}