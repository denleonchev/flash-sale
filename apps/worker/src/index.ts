/**
 * worker — consumer side of the order contract. Placeholder skeleton for card
 * S-E0.1; the real Nest worker (BullMQ consumer, Postgres transaction) lands in
 * a later E0 card.
 *
 * The only thing this file proves today: the worker consumes the same shared
 * payload type the api produces, so producer and consumer cannot drift. Change a
 * field in OrderJobPayload and both api and worker fail to build until they agree.
 */
import type { OrderJobPayload, OrderResult } from "@flash-sale/shared";

/**
 * Process one order job (§4 steps 6–9). Placeholder: the real handler runs the
 * payment step and commits in a Postgres transaction before publishing the
 * result. Concurrency-critical logic is governed by .claude/rules/concurrency.md.
 */
export function handleOrderJob(job: OrderJobPayload): OrderResult {
  return {
    idempotencyKey: job.idempotencyKey,
    status: "pending",
    remainingStock: 0,
  };
}