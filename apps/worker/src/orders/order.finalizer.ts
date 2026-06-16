import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../db/prisma.service.js";
import type { OrderJobPayload, OrderStatus } from "@flash-sale/shared";

/** P2002 = unique constraint violation in Prisma — job re-delivered after a crash. */
function isPrismaUniqueError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: unknown }).code === "P2002"
  );
}

/**
 * Finalizes one order job: runs payment simulation and writes the terminal order
 * row in a Postgres transaction.
 *
 * Concurrency correctness (§4, .claude/rules/concurrency.md):
 * - Serialisation: OrderProcessor runs with concurrency=1 — only one finalizeOrder
 *   call runs at a time, so two INSERT attempts never race each other.
 * - Idempotency (NFR-2): the INSERT uses idempotencyKey which carries a UNIQUE
 *   constraint in the DB. A job re-delivered after a crash hits P2002 on the second
 *   attempt → we catch it, read back the already-written row, and return. No second
 *   order is created, no second unit is confirmed — "never two".
 * - Transaction shim: $transaction wraps the single INSERT now; S-4.1 will add the
 *   guarded stock check inside the same atomic unit, S-4.2 will add stock release.
 * - Result delivery (FR-18) arrives in a later card: worker will publish to Redis
 *   pub/sub and the api will relay to the buyer's socket.
 */
@Injectable()
export class OrderFinalizer {
  private readonly logger = new Logger(OrderFinalizer.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Payment simulation. Always succeeds until S-4.2 wires in the failure branch. */
  private simulatePayment(_job: OrderJobPayload): { success: boolean } {
    return { success: true };
  }

  async finalizeOrder(job: OrderJobPayload): Promise<void> {
    // FR-13: every job must produce exactly one terminal status.
    const { success } = this.simulatePayment(job);

    // success-only branch; failure branch arrives in S-4.2
    void success;

    let finalStatus: OrderStatus;
    try {
      // $transaction shim: single INSERT today; guarded stock check (S-4.1) and
      // stock release on failure (S-4.2) slot into the same transaction later.
      await this.prisma.db.$transaction(async (tx) => {
        await tx.order.create({
          data: {
            saleId: job.saleId,
            buyerId: job.buyerId,
            idempotencyKey: job.idempotencyKey,
            status: "confirmed",
          },
        });
      });
      finalStatus = "confirmed";
    } catch (e) {
      if (isPrismaUniqueError(e)) {
        // Job was already processed (crash + BullMQ retry). Read back the existing
        // row — do NOT throw (that would cause an infinite retry loop).
        const existing = await this.prisma.db.order.findUniqueOrThrow({
          where: { idempotencyKey: job.idempotencyKey },
        });
        finalStatus = existing.status as OrderStatus;
      } else {
        throw e;
      }
    }

    this.logger.log(`finalized order ${job.idempotencyKey} -> ${finalStatus}`);
  }
}
