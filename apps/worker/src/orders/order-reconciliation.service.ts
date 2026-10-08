import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { context, propagation } from "@opentelemetry/api";
import { Queue } from "bullmq";
import { OrderStatus } from "@flash-sale/db/client";
import {
  CAPTURE_ORDER_JOB,
  CAPTURE_ORDER_JOB_OPTIONS,
  ORDER_QUEUE,
  type CaptureOrderJobPayload,
} from "@flash-sale/shared";
import { InventoryService } from "@flash-sale/inventory";
import {
  OrdersRepository,
  type ReconciledOrderStatus,
  type InProgressOrder,
} from "./orders.repository.js";
import { OrderResultPublisher } from "../realtime/order-result.publisher.js";
import { PAYMENT_INTENT_STATUSES, PaymentGateway } from "../payment/payment.gateway.js";

const DEFAULT_RECONCILE_AFTER_MINUTES = 2;
const RECONCILE_BATCH_SIZE = 50;

function getReconcileAfterMs(): number {
  const minutes = Number(process.env["ORDER_RECONCILE_AFTER_MINUTES"]);
  return (
    (Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_RECONCILE_AFTER_MINUTES) * 60_000
  );
}

@Injectable()
export class OrderReconciliationService {
  private readonly logger = new Logger(OrderReconciliationService.name);

  constructor(
    private readonly ordersRepo: OrdersRepository,
    private readonly inventory: InventoryService,
    private readonly orderResultPublisher: OrderResultPublisher,
    @Inject(PaymentGateway) private readonly payment: PaymentGateway,
    @InjectQueue(ORDER_QUEUE) private readonly captureQueue: Queue<CaptureOrderJobPayload>,
  ) {}

  async reconcileStaleOrders(): Promise<void> {
    const createdBefore = new Date(Date.now() - getReconcileAfterMs());
    const orders = await this.ordersRepo.findInProgressOrders(createdBefore, RECONCILE_BATCH_SIZE);

    for (const order of orders) {
      try {
        await this.reconcileOrder(order);
      } catch (err) {
        this.logger.error(`reconciliation failed for order ${order.id}`, err);
      }
    }
  }

  async reconcileOrderById(orderId: string): Promise<void> {
    const order = await this.ordersRepo.findInProgressOrderById(orderId);
    if (!order) {
      this.logger.log(`order ${orderId} is no longer in_progress — nothing to reconcile`);
      return;
    }
    await this.reconcileOrder(order);
  }

  private async reconcileOrder(order: InProgressOrder): Promise<void> {
    if (!order.paymentRef) {
      await this.closeOrder(order, OrderStatus.expired);
      return;
    }

    const piStatus = await this.payment.retrievePIStatus(order.paymentRef);
    this.logger.log(`order ${order.id}: PI ${order.paymentRef} is ${piStatus}`);

    switch (piStatus) {
      case PAYMENT_INTENT_STATUSES.REQUIRES_CAPTURE:
        await this.enqueueCapture(order, order.paymentRef);
        return;
      case PAYMENT_INTENT_STATUSES.REQUIRES_CONFIRMATION:
      case PAYMENT_INTENT_STATUSES.REQUIRES_ACTION:
        await this.closeOrder(order, OrderStatus.expired, order.paymentRef);
        return;
      case PAYMENT_INTENT_STATUSES.REQUIRES_PAYMENT_METHOD:
        await this.closeOrder(order, OrderStatus.failed, order.paymentRef);
        return;
      case PAYMENT_INTENT_STATUSES.CANCELED:
        await this.closeOrder(order, OrderStatus.failed);
        return;
      case PAYMENT_INTENT_STATUSES.PROCESSING:
        return;
      case PAYMENT_INTENT_STATUSES.SUCCEEDED:
        this.logger.error(
          `order ${order.id} is in_progress but PI ${order.paymentRef} is succeeded — needs manual review`,
        );
        return;
      default: {
        const unhandled: never = piStatus;
        this.logger.error(`order ${order.id}: unhandled PI status ${String(unhandled)}`);
      }
    }
  }

  private async closeOrder(
    order: InProgressOrder,
    status: ReconciledOrderStatus,
    paymentIntentIdToCancel?: string,
  ): Promise<void> {
    const { didTransition } = await this.ordersRepo.closeInProgressOrder(order.id, status);
    if (!didTransition) {
      this.logger.debug(`order ${order.id} was finalized elsewhere — skipping`);
      return;
    }

    await this.inventory.releaseStock(order.saleId, 1);

    if (paymentIntentIdToCancel) {
      try {
        await this.payment.cancelPI(paymentIntentIdToCancel);
      } catch (err) {
        this.logger.error(
          `order ${order.id} is ${status} but cancelling PI ${paymentIntentIdToCancel} failed — cancel it manually`,
          err,
        );
      }
    }

    await this.orderResultPublisher.publishOrderResult({
      buyerId: order.buyerId,
      saleId: order.saleId,
      status,
      orderId: order.id,
    });

    this.logger.log(`reconciled order ${order.id} -> ${status}`);
  }

  private async enqueueCapture(order: InProgressOrder, paymentIntentId: string): Promise<void> {
    const existing = await this.captureQueue.getJob(order.id);
    if (existing && (await existing.isFailed())) {
      await existing.retry();
      this.logger.warn(`retried failed capture job for order ${order.id}`);
      return;
    }

    const carrier: Record<string, string> = {};
    propagation.inject(context.active(), carrier);

    await this.captureQueue.add(
      CAPTURE_ORDER_JOB,
      {
        orderId: order.id,
        saleId: order.saleId,
        buyerId: order.buyerId,
        paymentIntentId,
        idempotencyKey: order.idempotencyKey,
        traceparent: carrier["traceparent"],
      },
      { jobId: order.id, ...CAPTURE_ORDER_JOB_OPTIONS },
    );
    this.logger.log(`enqueued capture job for stale order ${order.id}`);
  }
}
