/**
 * Consumer side of the order contract (placeholder for the future BullMQ
 * processor). Kept so worker genuinely depends on @flash-sale/shared in code,
 * not just in package.json — the contract link from S-E0.1 stays alive. The real
 * processor (payment step → Postgres transaction → pub/sub result) is wired in
 * S-E0.4. Concurrency-critical logic is governed by .claude/rules/concurrency.md.
 */
import type { OrderJobPayload, OrderResult } from "@flash-sale/shared";

/**
 * Process one order job (§4 steps 6–9). Placeholder: returns a pending result
 * without doing the real work yet.
 */
export function handleOrderJob(job: OrderJobPayload): OrderResult {
  return {
    idempotencyKey: job.idempotencyKey,
    status: "pending",
    remainingStock: 0,
  };
}
