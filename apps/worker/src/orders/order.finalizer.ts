import { Injectable, Logger } from "@nestjs/common";
import type { OrderJobPayload, OrderStatus } from "@flash-sale/shared";
import { OrdersRepository } from "./orders.repository.js";
import { StockPublisher } from "../realtime/stock.publisher.js";
import { OrderResultPublisher } from "../realtime/order-result.publisher.js";

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
 * row via OrdersRepository.
 *
 * Concurrency correctness (§4, .claude/rules/concurrency.md):
 * - Serialisation: OrderProcessor runs with concurrency=1 — only one finalizeOrder
 *   call runs at a time, so two INSERT attempts never race each other.
 * - Idempotency (NFR-2): the INSERT uses idempotencyKey which carries a UNIQUE
 *   constraint in the DB. A job re-delivered after a crash hits P2002 on the second
 *   attempt → we catch it, read back the already-written row, and return. No second
 *   order is created, no second unit is confirmed — "never two".
 * - Transaction: confirmOrderAndGetRemaining wraps INSERT + remaining-stock read in
 *   one $transaction (read-your-writes, FR-17); S-4.1 will add the guarded stock
 *   check, S-4.2 will add stock release inside the same unit.
 * - Live stock (FR-17): after the order is committed we publish the post-confirm
 *   remaining to Redis pub/sub; the api relays it to everyone watching the sale
 *   (§4 steps 9–10, §6). Broadcast is strictly downstream of the authoritative
 *   confirm and does not affect stock correctness — concurrency=1 makes the read
 *   race-free, and the absolute payload is idempotent.
 * - Per-buyer result delivery (FR-18): published to ORDER_RESULT_CHANNEL after the stock broadcast.
 */
@Injectable()
export class OrderFinalizer {
  private readonly logger = new Logger(OrderFinalizer.name);

  constructor(
    private readonly ordersRepo: OrdersRepository,
    private readonly stockPublisher: StockPublisher,
    private readonly orderResultPublisher: OrderResultPublisher,
  ) {}

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
    let remainingStock: number;
    try {
      // INSERT + remaining-stock read in one tx (read-your-writes, FR-17).
      remainingStock = await this.ordersRepo.confirmOrderAndGetRemaining(job);
      finalStatus = "confirmed";
    } catch (e) {
      if (isPrismaUniqueError(e)) {
        // Job was already processed (crash + BullMQ retry). Read back the existing
        // row — do NOT throw (that would cause an infinite retry loop).
        const existing = await this.ordersRepo.findOrderByIdempotencyKey(
          job.idempotencyKey,
        );
        finalStatus = existing.status as OrderStatus;
        // Republish the current count (safe at concurrency=1, idempotent payload).
        remainingStock = await this.ordersRepo.getRemainingStock(job.saleId);
      } else {
        throw e;
      }
    }

    // FR-17: tell everyone watching the sale the new number (api relays via socket).
    await this.stockPublisher.publishStock({ saleId: job.saleId, remainingStock });

    // FR-18: tell the buyer their personal result (api routes to private user room).
    await this.orderResultPublisher.publishOrderResult({
      buyerId: job.buyerId,
      saleId: job.saleId,
      status: finalStatus,
    });

    this.logger.log(`finalized order ${job.idempotencyKey} -> ${finalStatus}`);
  }
}
