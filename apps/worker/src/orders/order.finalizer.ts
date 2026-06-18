import { Injectable, Logger } from "@nestjs/common";
import {
  ORDER_STATUSES,
  type OrderJobPayload,
  type OrderStatus,
} from "@flash-sale/shared";
import { OrdersRepository } from "./orders.repository.js";
import { StockReleaseService } from "./stock-release.service.js";
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
 * - Success path / guarded write (S-4.1, FR-15/NFR-1): createGuardedOrder locks the
 *   sale row inside the tx and confirms only while confirmed < stockTotal, else records
 *   sold_out — DB is the final authority and can never exceed stockTotal.
 * - Failure path (S-4.2, FR-11/FR-16): createFailedOrder writes a `failed` row with
 *   no row lock — `failed` orders are excluded from remaining = stockTotal − confirmed,
 *   so they don't affect the stock guard at all. After the durable DB write,
 *   StockReleaseService.releaseStock runs INCRBY to return the reserved unit to Redis.
 *   Both steps are inside the same try block: if INCRBY crashes, the job rethrows,
 *   BullMQ retries, and the retry hits P2002 on createFailedOrder — the catch path
 *   reads back the existing row and skips the second INCRBY, avoiding double-release.
 *   The cost: if INCRBY never succeeds between retries, one Redis unit stays stuck
 *   (under-counted), but the DB guard prevents oversell regardless.
 * - Idempotency (NFR-2): UNIQUE(idempotency_key) + P2002 catch handles retries for
 *   both paths. The catch reads back the already-written row, so no second order is
 *   created and no second unit is confirmed or double-released.
 * - Live stock (FR-17): after the order is committed we publish the post-confirm
 *   remaining to Redis pub/sub; the api relays it to everyone watching the sale.
 * - Per-buyer result delivery (FR-18): published after the stock broadcast.
 */
@Injectable()
export class OrderFinalizer {
  private readonly logger = new Logger(OrderFinalizer.name);

  constructor(
    private readonly ordersRepo: OrdersRepository,
    private readonly stockPublisher: StockPublisher,
    private readonly orderResultPublisher: OrderResultPublisher,
    private readonly stockReleaseService: StockReleaseService,
  ) {}

  /** FR-11: PAYMENT_FAIL_RATE env var (0.0–1.0, default 0 = always succeed). */
  private simulatePayment(_job: OrderJobPayload): { success: boolean } {
    const paymentFailRate = parseFloat(process.env["PAYMENT_FAIL_RATE"] ?? "0");
    return { success: Math.random() >= paymentFailRate };
  }

  async finalizeOrder(job: OrderJobPayload): Promise<void> {
    // FR-13: every job must produce exactly one terminal status.
    const { success } = this.simulatePayment(job);

    let finalStatus: OrderStatus;
    let remainingStock: number;

    if (success) {
      // Success path: guarded write decides confirmed vs sold_out under the sale-row lock (FR-15).
      try {
        const result = await this.ordersRepo.createGuardedOrder(job);
        finalStatus = result.status;
        remainingStock = result.remaining;
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
    } else {
      // Failure path: write failed row then release the reserved Redis unit (FR-11, FR-16).
      // releaseStock is inside the try so a Redis crash rethrows, BullMQ retries, and the
      // retry's P2002 on createFailedOrder skips the second INCRBY. See JSDoc above.
      try {
        await this.ordersRepo.createFailedOrder(job);
        await this.stockReleaseService.releaseStock(job.saleId, job.quantity);
        finalStatus = ORDER_STATUSES.FAILED;
      } catch (e) {
        if (!isPrismaUniqueError(e)) throw e;
        // Job re-delivered: terminal row already exists; don't re-release Redis stock.
        const existing = await this.ordersRepo.findOrderByIdempotencyKey(
          job.idempotencyKey,
        );
        finalStatus = existing.status as OrderStatus;
      }
      remainingStock = await this.ordersRepo.getRemainingStock(job.saleId);
    }

    // FR-17: tell everyone watching the sale the new number (api relays via socket).
    await this.stockPublisher.publishStock({
      saleId: job.saleId,
      remainingStock,
    });

    // FR-18: tell the buyer their personal result (api routes to private user room).
    await this.orderResultPublisher.publishOrderResult({
      buyerId: job.buyerId,
      saleId: job.saleId,
      status: finalStatus,
    });

    this.logger.log(`finalized order ${job.idempotencyKey} -> ${finalStatus}`);
  }
}
