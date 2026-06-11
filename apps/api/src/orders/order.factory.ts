/**
 * Producer side of the order contract (placeholder for the future orders module).
 * Kept so api genuinely depends on @flash-sale/shared in code, not just in
 * package.json — the contract link from S-E0.1 stays alive. The real enqueue path
 * (atomic Redis reservation → BullMQ) is wired in S-E0.4.
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
