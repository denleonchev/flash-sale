/**
 * Single contract between `api` and `worker` — import from here, never redefine.
 * See docs/technical-design.md §4 (Purchase Flow) and §5 (Data Model).
 */

/**
 * `as const` so `ORDER_STATUS_VALUES` works with `z.enum(...)` and Prisma `{ in: [...] }`.
 *
 * - `in_progress` — reserved + enqueued; worker hasn't finished yet.
 * - `confirmed`   — worker committed; stock decremented in DB.
 * - `sold_out`    — guarded DB write found no remaining stock.
 * - `failed`      — payment failed; reserved unit released back to Redis.
 */
export const ORDER_STATUSES = {
  IN_PROGRESS: "in_progress",
  CONFIRMED: "confirmed",
  SOLD_OUT: "sold_out",
  FAILED: "failed",
} as const;

export type OrderStatus = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES];

/** Tuple form for `z.enum(ORDER_STATUS_VALUES)` and Prisma `{ in: [...] }`. */
export const ORDER_STATUS_VALUES = Object.values(ORDER_STATUSES) as [OrderStatus, ...OrderStatus[]];

/** Shared so producer (api) and consumer (worker) cannot drift apart. (NFR-11) */
export const ORDER_QUEUE = "orders";
export const ORDER_JOB = "process-order";
// FR-12: Stripe authorize/capture — enqueued by the webhook when PI is capturable.
export const CAPTURE_ORDER_JOB = "capture-order";

export const SOCKET_EVENTS = {
  SALE_STOCK_SUBSCRIBE: "sale:stock:subscribe", // client → server (FR-17, FR-19)
  ORDER_RESULT_SUBSCRIBE: "order:result:subscribe", // client → server (FR-18, FR-19)
  ORDER_RESULT_UNSUBSCRIBE: "order:result:unsubscribe", // client → server (FR-19)
  SALE_STOCK_UPDATED: "sale:stock:updated", // server → sale room (FR-17)
  ORDER_RESULT_UPDATED: "order:result:updated", // server → buyer room (FR-18)
} as const;

export function getSaleRoomId(saleId: string): string {
  return `sale:${saleId}`;
}

export const getStockKey = (saleId: string) => `stock:${saleId}`;

export function getUserRoomId(buyerId: string): string {
  return `user:${buyerId}`;
}

/** worker publishes, api subscribes. (FR-17, FR-18) */
export const REDIS_CHANNELS = {
  STOCK: "stock:updates",
  ORDER_RESULT: "order:results",
} as const;

export interface SaleStockUpdatedPayload {
  saleId: string;
  remainingStock: number;
}

export interface OrderJobPayload {
  saleId: string;
  buyerId: string;
  /**
   * Used verbatim as the BullMQ job id (FR-14). BullMQ forbids ':' in job ids
   * (Redis key separator) — keep this url-safe (letters, digits, '-', '_').
   */
  idempotencyKey: string;
  quantity: number;
  /** FR-12 [Ext]: Stripe PaymentMethod ID from the frontend. Absent when PAYMENT_PROVIDER=fake. */
  paymentMethodId?: string;
  /** FR-12 [Ext]: sale price in cents forwarded from the Sale record so the worker never re-fetches it. */
  priceCents: number;
}

/** FR-12: payload for the capture-order BullMQ job (enqueued by webhook, processed by worker). */
export interface CaptureOrderJobPayload {
  orderId: string;
  saleId: string;
  buyerId: string;
  paymentIntentId: string;
  idempotencyKey: string;
}

export interface OrderResult {
  buyerId: string;
  saleId: string;
  status: OrderStatus;
  /** Carried to the client so ORDER_RESULT_UNSUBSCRIBE can target the exact row. */
  orderId: string;
}

export interface OrderResultUpdatedPayload {
  saleId: string;
  status: OrderStatus;
  orderId: string;
}

/** Never stored — derived from time + stock. (FR-2) */
export const SALE_STATES = {
  UPCOMING: "upcoming",
  LIVE: "live",
  ENDED: "ended",
} as const;

export type SaleState = (typeof SALE_STATES)[keyof typeof SALE_STATES];

/**
 * `now` is injected so callers control the clock without mocking Date. (FR-2)
 * Accepts `Date` so Prisma DateTime fields pass through without conversion.
 */
export function deriveSaleState(
  sale: { startsAt: Date; endsAt: Date; remainingStock: number },
  now: Date,
): SaleState {
  if (now < sale.startsAt) return SALE_STATES.UPCOMING;
  if (now >= sale.endsAt || sale.remainingStock <= 0) return SALE_STATES.ENDED;
  return SALE_STATES.LIVE;
}

/** FR-1: body of POST /sales. Neither Zod nor class-validator live here — shared stays framework-agnostic. */
export interface CreateSale {
  title: string;
  description?: string;
  stockTotal: number;
  startsAt: string; // ISO-8601
  endsAt: string; // ISO-8601
  priceCents: number; // price in smallest currency unit (cents); Stripe uses integers
}

// FR-26: background sale embedding queue (S-6.2).
export const EMBED_SALE_QUEUE = "embed-sales";
export const EMBED_SALE_JOB = "embed-sale";

export interface EmbedSaleJobPayload {
  saleId: string;
  title: string;
  description?: string;
}

// FR-27: fraud screening queue (S-6.4 / S-6.5).
export const FRAUD_SCREENING_QUEUE = "fraud-screening";
export const FRAUD_SCREENING_JOB = "screen-order-fraud";

export interface FraudScreeningJobPayload {
  orderId: string;
  buyerId: string;
  saleId: string;
}

export const RISK_LEVELS = { LOW: "low", MEDIUM: "medium", HIGH: "high" } as const;
export type RiskLevel = (typeof RISK_LEVELS)[keyof typeof RISK_LEVELS];

export const FRAUD_FLAG_STATUSES = { OPEN: "open", REVIEWED: "reviewed" } as const;
export type FraudFlagStatus = (typeof FRAUD_FLAG_STATUSES)[keyof typeof FRAUD_FLAG_STATUSES];

export interface FraudFlag {
  id: string;
  orderId: string;
  buyerId: string;
  buyerEmail: string | null;
  buyerName: string | null;
  saleId: string;
  saleTitle: string;
  risk: RiskLevel;
  reason: string;
  pattern: string;
  status: FraudFlagStatus;
  createdAt: string;
  reviewedAt: string | null;
}

/** Neither Zod nor class-validator live here — shared stays framework-agnostic. (FR-5) */
export interface Sale {
  id: string;
  title: string;
  description?: string;
  state: SaleState;
  remainingStock: number;
  startsAt: string; // ISO-8601 — JSON-serialisable
  endsAt: string;
  serverNow: string; // anchors client countdown; eliminates clock skew
  priceCents: number;
}
