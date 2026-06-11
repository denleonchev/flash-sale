/**
 * api — producer side of the order contract. Placeholder skeleton for card
 * S-E0.1; the real Nest app (HTTP + Socket.IO gateway) lands in a later E0 card.
 *
 * The only thing this file proves today: api builds the queue payload using the
 * one shared type, so it cannot drift from the worker that consumes it.
 */
import type { OrderJobPayload } from "@flash-sale/shared";

/**
 * Construct the BullMQ order job after a successful reservation (§4 step 4).
 * The real implementation enqueues this with `idempotencyKey` as the job id.
 */
export function buildOrderJob(
  saleId: string,
  buyerId: string,
  idempotencyKey: string,
  quantity: number,
): OrderJobPayload {
  return { saleId, buyerId, idempotencyKey, quantity };
}