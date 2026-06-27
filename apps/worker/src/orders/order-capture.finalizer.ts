import { Inject, Injectable, Logger } from "@nestjs/common";
import { OrderStatus } from "@flash-sale/db/client";
import { ORDER_STATUSES, type CaptureOrderJobPayload } from "@flash-sale/shared";
import { OrdersRepository } from "./orders.repository.js";
import { StockReleaseService } from "./stock-release.service.js";
import { StockPublisher } from "../realtime/stock.publisher.js";
import { OrderResultPublisher } from "../realtime/order-result.publisher.js";
import { PaymentGateway } from "../payment/payment.gateway.js";
import { FraudScreeningProducer } from "../fraud/fraud-screening.producer.js";

/**
 * Finalizes a Stripe authorize/capture order (FR-12).
 *
 * Concurrency correctness (concurrency.md):
 *
 * Two buyers reach requires_capture simultaneously. Worker concurrency=1 ensures
 * jobs run one at a time. For each job:
 *
 * Confirmed path (confirmed < stockTotal):
 *   - decideCaptureOrCancel() runs SELECT FOR UPDATE → decides confirmed → commits.
 *   - capturePI() runs AFTER the DB commit with an idempotency key.
 *   - Known trade-off: if the process crashes between commit and capturePI(), the
 *     order is confirmed in DB but the PI is still requires_capture. On BullMQ retry
 *     the WHERE guard returns count=0 (already confirmed) — capturePI() is NOT retried.
 *     Recovery: capturePI() can be called manually, or the PI expires after 7 days
 *     and the order needs to be manually failed. This window is extremely narrow and
 *     acceptable for the project scope.
 *   - If commit fails: capturePI() is never called → retry → decides again → correct.
 *
 * Sold-out path (confirmed >= stockTotal):
 *   - decideCaptureOrCancel() updates to sold_out inside the FOR UPDATE transaction.
 *   - didTransition=true → release Redis unit once. count=0 on retry → skip release.
 *   - cancelPI() fires after DB commit. If it fails the PI expires in 7 days; the
 *     bank releases the hold automatically. Buyer is notified sold_out immediately.
 *   - No refund needed — money was never captured. (FR-12 advantage over charge path)
 */
@Injectable()
export class CaptureOrderFinalizer {
  private readonly logger = new Logger(CaptureOrderFinalizer.name);

  constructor(
    private readonly ordersRepo: OrdersRepository,
    private readonly stockPublisher: StockPublisher,
    private readonly orderResultPublisher: OrderResultPublisher,
    private readonly stockReleaseService: StockReleaseService,
    @Inject(PaymentGateway) private readonly payment: PaymentGateway,
    private readonly fraudProducer: FraudScreeningProducer,
  ) {}

  async finalizeCapture(job: CaptureOrderJobPayload): Promise<void> {
    const { status, orderId, remainingStock, didTransition } =
      await this.ordersRepo.decideCaptureOrCancel(job.orderId, job.saleId);

    if (didTransition) {
      if (status === OrderStatus.confirmed) {
        await this.payment.capturePI(job.paymentIntentId, job.idempotencyKey);
      } else {
        // quantity is always 1 — the system does not support multi-unit orders.
        await this.stockReleaseService.releaseStock(job.saleId, 1);
        // Fire-and-forget: PI expires in 7 days if cancel fails; buyer notified sold_out now.
        void this.payment.cancelPI(job.paymentIntentId);
      }
    }

    void this.fraudProducer.enqueue({ orderId, buyerId: job.buyerId, saleId: job.saleId });

    await this.stockPublisher.publishStock({ saleId: job.saleId, remainingStock });

    await this.orderResultPublisher.publishOrderResult({
      buyerId: job.buyerId,
      saleId: job.saleId,
      status: status as (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES],
      orderId,
    });

    this.logger.log(`capture finalized order ${job.orderId} -> ${status}`);
  }
}
