import { Injectable, Logger } from "@nestjs/common";
import { type OrderJobPayload } from "@flash-sale/shared";
import { OrdersRepository, type GuardedOrderResult } from "./orders.repository.js";
import { StockReleaseService } from "./stock-release.service.js";
import { StockPublisher } from "../realtime/stock.publisher.js";
import { OrderResultPublisher } from "../realtime/order-result.publisher.js";

/**
 * Finalizes one order job: runs payment simulation and transitions the in_progress
 * order row to its terminal status via OrdersRepository.
 *
 * Concurrency correctness (§4, .claude/rules/concurrency.md):
 * - Both paths use guarded UPDATE (`WHERE status = in_progress`) so a re-delivered
 *   job finds count=0 (row already terminal) and acts at most once.
 * - Success path / guarded write (S-4.1, FR-15/NFR-1): confirmOrderGuarded locks
 *   the sale row inside the tx and sets confirmed only while confirmed < stockTotal,
 *   else sold_out — DB is the final authority and can never exceed stockTotal.
 * - Failure path (S-4.2, FR-11/FR-16): failOrder transitions in_progress→failed.
 *   count>0 → we own the release, call INCRBY. count=0 → already terminal, skip
 *   release. Trade-off: a crash between UPDATE and INCRBY leaves one Redis unit
 *   stuck (under-counted), but the DB guard prevents oversell regardless.
 * - Idempotency (NFR-2): the WHERE guard on both paths replaces the old P2002 catch.
 *   No second INSERT, no second confirm, no double-release.
 * - Live stock (FR-17): after the transition we publish the post-confirm remaining.
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
    const { status, orderId, remainingStock } = await this.resolveOrder(job);

    // FR-17: tell everyone watching the sale the new stock count.
    await this.stockPublisher.publishStock({
      saleId: job.saleId,
      remainingStock,
    });

    // FR-18: tell the buyer their personal result.
    await this.orderResultPublisher.publishOrderResult({
      buyerId: job.buyerId,
      saleId: job.saleId,
      status,
      orderId,
    });

    this.logger.log(`finalized order ${job.idempotencyKey} -> ${status}`);
  }

  /**
   * Runs payment and transitions the in_progress row to its terminal status. (FR-13)
   * Returns the resolved status, orderId, and post-write remainingStock for publishing.
   */
  private async resolveOrder(job: OrderJobPayload): Promise<GuardedOrderResult> {
    if (this.simulatePayment(job).success) {
      // Success: guarded UPDATE decides confirmed vs sold_out under sale-row lock.
      // count=0 (redelivery) → reads back the existing terminal row. (NFR-2)
      return this.ordersRepo.confirmOrderGuarded(job);
    }

    // Failure: transition in_progress→failed, release Redis unit only if we made
    // the transition. transitioned=false means already terminal → skip to avoid double-release.
    const { updatedCount, ...result } = await this.ordersRepo.failOrder(job);
    if (updatedCount > 0) {
      await this.stockReleaseService.releaseStock(job.saleId, job.quantity);
    }
    return result;
  }
}
