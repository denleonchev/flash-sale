import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import Stripe from "stripe";
import {
  ORDER_QUEUE,
  CAPTURE_ORDER_JOB,
  ORDER_STATUSES,
  type CaptureOrderJobPayload,
} from "@flash-sale/shared";
import { OrdersRepository } from "../orders/orders.repository.js";
import { OrderResultPublisher } from "../orders/order-result.publisher.js";
import { StockService } from "../stock/stock.service.js";

/**
 * Handles Stripe webhook events for the authorize/capture flow (FR-12).
 *
 * Two events drive order state transitions:
 *
 * `payment_intent.amount_capturable_updated` — PI is authorized (requires_capture).
 *   Find the in_progress order → enqueue capture-order job → worker decides
 *   capture or cancel based on live stock.
 *
 * `payment_intent.payment_failed` — card declined or 3DS failed.
 *   Find the in_progress order → transition to failed → release Redis unit → notify buyer.
 *
 * `payment_intent.canceled` — PI expired or was cancelled externally.
 *   Same cleanup as payment_failed.
 *
 * Concurrency (concurrency.md):
 * - `findInProgressOrderByPaymentRef` is a read; the WHERE status=in_progress guard
 *   on `failFromWebhook` makes the failure path idempotent on Stripe webhook retry.
 * - Capture enqueue is idempotent: BullMQ uses orderId as jobId — a duplicate
 *   `amount_capturable_updated` event finds the job already queued and is a no-op.
 * - Stock release on failure: `transitioned=false` on retry → skip INCRBY.
 *   Trade-off: a crash between failFromWebhook and releaseStock leaves one unit stuck
 *   (under-count), but the DB guard in the capture worker prevents oversell regardless.
 */
@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly ordersRepo: OrdersRepository,
    private readonly orderResultPublisher: OrderResultPublisher,
    private readonly stockService: StockService,
    @InjectQueue(ORDER_QUEUE) private readonly captureQueue: Queue<CaptureOrderJobPayload>,
  ) {
    this.stripe = new Stripe(process.env["STRIPE_SECRET_KEY"]!);
  }

  async handleEvent(rawBody: Buffer, sig: string): Promise<void> {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        sig,
        process.env["STRIPE_WEBHOOK_SECRET"]!,
      );
    } catch {
      throw new BadRequestException("invalid Stripe webhook signature");
    }

    switch (event.type) {
      case "payment_intent.amount_capturable_updated":
        await this.handleCapturable(event.data.object as Stripe.PaymentIntent);
        break;
      case "payment_intent.payment_failed":
      case "payment_intent.canceled":
        await this.handleFailed(event.data.object as Stripe.PaymentIntent);
        break;
      default:
        this.logger.debug(`unhandled Stripe event: ${event.type}`);
    }
  }

  private async handleCapturable(pi: Stripe.PaymentIntent): Promise<void> {
    const order = await this.ordersRepo.findInProgressOrderByPaymentRef(pi.id);
    if (!order) {
      this.logger.debug(`amount_capturable_updated: no in_progress order for PI ${pi.id}`);
      return;
    }

    // jobId = orderId makes this idempotent: duplicate webhook → BullMQ no-op. (NFR-2)
    await this.captureQueue.add(
      CAPTURE_ORDER_JOB,
      {
        orderId: order.id,
        saleId: order.saleId,
        buyerId: order.buyerId,
        paymentIntentId: pi.id,
        idempotencyKey: order.idempotencyKey,
      },
      {
        jobId: order.id,
        removeOnComplete: true,
        removeOnFail: 100,
        attempts: 3,
        backoff: { type: "exponential", delay: 1_000 },
      },
    );

    this.logger.log(`enqueued capture job for order ${order.id}`);
  }

  private async handleFailed(pi: Stripe.PaymentIntent): Promise<void> {
    const order = await this.ordersRepo.findInProgressOrderByPaymentRef(pi.id);
    if (!order) {
      this.logger.debug(`${pi.status}: no in_progress order for PI ${pi.id}`);
      return;
    }

    const { transitioned } = await this.ordersRepo.failFromWebhook(order.id);
    if (transitioned) {
      // quantity is always 1 — the system does not support multi-unit orders.
      await this.stockService.releaseStock(order.saleId, 1);
    }

    await this.orderResultPublisher.publishOrderResult({
      buyerId: order.buyerId,
      saleId: order.saleId,
      status: ORDER_STATUSES.FAILED,
      orderId: order.id,
    });

    this.logger.log(`webhook failed order ${order.id} (PI ${pi.id})`);
  }
}
