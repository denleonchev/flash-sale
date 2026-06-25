import { Inject, Injectable, Logger } from "@nestjs/common";
import { OrderStatus } from "@flash-sale/db/client";
import { type OrderJobPayload } from "@flash-sale/shared";
import { OrdersRepository, type GuardedOrderResult } from "./orders.repository.js";
import { StockReleaseService } from "./stock-release.service.js";
import { StockPublisher } from "../realtime/stock.publisher.js";
import { OrderResultPublisher } from "../realtime/order-result.publisher.js";
import { PaymentGateway } from "../payment/payment.gateway.js";
import { FraudScreeningProducer } from "../fraud/fraud-screening.producer.js";

/**
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
 * - Stripe idempotency (FR-12, NFR-2): charge() passes idempotencyKey to Stripe so
 *   a BullMQ retry reuses the same PaymentIntent without a second charge.
 * - Refund on sold_out (FR-12): if Stripe charged but DB says sold_out, we refund
 *   immediately. refund() passes `refund-${idempotencyKey}` to Stripe so a retry
 *   after a crash between the DB write and the refund call is also idempotent.
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
    @Inject(PaymentGateway) private readonly payment: PaymentGateway,
    private readonly fraudProducer: FraudScreeningProducer,
  ) {}

  async finalizeOrder(job: OrderJobPayload): Promise<void> {
    const { status, orderId, remainingStock } = await this.resolveOrder(job);

    // FR-27: fire-and-forget — fraud check is off the purchase path.
    void this.fraudProducer.enqueue({ orderId, buyerId: job.buyerId, saleId: job.saleId });

    await this.stockPublisher.publishStock({
      saleId: job.saleId,
      remainingStock,
    });

    await this.orderResultPublisher.publishOrderResult({
      buyerId: job.buyerId,
      saleId: job.saleId,
      status,
      orderId,
    });

    this.logger.log(`finalized order ${job.idempotencyKey} -> ${status}`);
  }

  private async resolveOrder(job: OrderJobPayload): Promise<GuardedOrderResult> {
    const { success, paymentRef } = await this.payment.charge(
      job.idempotencyKey,
      job.paymentMethodId,
      job.priceCents,
    );

    if (success) {
      const result = await this.ordersRepo.confirmOrderGuarded(job, paymentRef);
      // sold_out after Stripe charged: refund so the buyer is not billed for an item
      // they didn't receive. Idempotent via `refund-${idempotencyKey}` on retry.
      if (result.status === OrderStatus.sold_out && paymentRef !== null) {
        await this.payment.refund(paymentRef, job.idempotencyKey);
      }
      return result;
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
