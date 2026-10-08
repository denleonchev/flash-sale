import { InjectQueue } from "@nestjs/bullmq";
import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { context, propagation } from "@opentelemetry/api";
import { Queue } from "bullmq";
import Stripe from "stripe";
import {
  ORDER_RECONCILIATION_QUEUE,
  ORDER_STATUSES,
  RECONCILE_ORDER_JOB,
  SALE_STATES,
  type OrderResultUpdatedPayload,
  type ReconcileOrderJobPayload,
  type Sale,
} from "@flash-sale/shared";
import { InventoryService } from "@flash-sale/inventory";

import { SalesService } from "../sales/sales.service.js";
import { UsersService } from "../users/users.service.js";
import { OrderResultPublisher } from "./order-result.publisher.js";
import { OrdersRepository } from "./orders.repository.js";
import type { AbandonCheckoutDto } from "./dto/abandon-checkout.dto.js";
import type { CreateOrderDto } from "./dto/create-order.dto.js";

/** P2002 = unique constraint violation in Prisma. */
function isPrismaUniqueError(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002"
  );
}

export type BuyResult = { status: string; idempotencyKey: string; clientSecret?: string };
export type AbandonCheckoutResult = { enqueued: boolean };

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly stripe = new Stripe(process.env["STRIPE_SECRET_KEY"]!);

  constructor(
    private readonly orderResultPublisher: OrderResultPublisher,
    private readonly inventory: InventoryService,
    private readonly salesService: SalesService,
    private readonly ordersRepository: OrdersRepository,
    private readonly usersService: UsersService,
    @InjectQueue(ORDER_RECONCILIATION_QUEUE)
    private readonly reconciliationQueue: Queue<ReconcileOrderJobPayload>,
  ) {}

  async buy(dto: CreateOrderDto): Promise<BuyResult> {
    await this.usersService.upsertBuyer(dto.buyerId, dto.email, dto.name);
    const sale = await this.assertSaleLive(dto.saleId);

    // Non-failed order (in_progress/confirmed/sold_out) is a permanent block.
    const blocking = await this.ordersRepository.findBlockingOrder(dto.buyerId, dto.saleId);
    if (blocking) {
      this.logger.debug(
        `buyer ${dto.buyerId} already has a blocking order for sale ${dto.saleId} (status=${blocking.status}, key=${blocking.idempotencyKey})`,
      );
      return { status: "accepted", idempotencyKey: blocking.idempotencyKey };
    }

    const idempotencyKey = await this.buildIdempotencyKey(dto.buyerId, dto.saleId);
    return this.executeStripeOrder(dto, idempotencyKey, sale.priceCents);
  }

  /**
   * FR-29: the buyer requested the sale page again, so an unauthorized payment is
   * treated as abandoned. This only hands the order to the worker's reconciliation —
   * the provider call and every state change happen there, off the request path.
   *
   * Concurrency (concurrency.md): no state is changed here. The job names one order id;
   * the worker transitions it with WHERE status = in_progress like every other party,
   * and an order created after this lookup has a different id.
   */
  async abandonCheckout(dto: AbandonCheckoutDto): Promise<AbandonCheckoutResult> {
    const order = await this.ordersRepository.findInProgressOrder(dto.buyerId, dto.saleId);
    if (!order) return { enqueued: false };

    const carrier: Record<string, string> = {};
    propagation.inject(context.active(), carrier);

    await this.reconciliationQueue.add(
      RECONCILE_ORDER_JOB,
      { orderId: order.id, traceparent: carrier["traceparent"] },
      {
        // Repeated page requests collapse into one job while it is waiting or running.
        jobId: order.id,
        removeOnComplete: true,
        // A retained failed job would make every later add() for this order a silent no-op.
        removeOnFail: true,
        attempts: 3,
        backoff: { type: "exponential", delay: 1_000 },
      },
    );
    this.logger.log(`enqueued on-demand reconciliation for order ${order.id}`);
    return { enqueued: true };
  }

  getLatestFinalizedOrder(
    buyerId: string,
    saleId: string,
  ): Promise<OrderResultUpdatedPayload | null> {
    return this.ordersRepository.getLatestFinalizedOrder(buyerId, saleId);
  }

  acknowledgeOrderResult(orderId: string): Promise<unknown> {
    return this.ordersRepository.acknowledgeOrderResult(orderId);
  }

  // FR-3: reject unless the sale is currently live.
  private async assertSaleLive(saleId: string): Promise<Sale> {
    const sale = await this.salesService.getSaleById(saleId);
    if (!sale) {
      throw new ConflictException("sale not found");
    }
    if (sale.state !== SALE_STATES.LIVE) {
      const reason =
        sale.state === SALE_STATES.UPCOMING ? "sale not started yet" : "sale has ended";
      throw new ConflictException(reason);
    }
    return sale;
  }

  // FR-14, FR-16: retry gets a unique suffix so the UNIQUE constraint is not violated across attempts.
  private async buildIdempotencyKey(buyerId: string, saleId: string): Promise<string> {
    const base = `${buyerId}-${saleId}`;
    const retryableCount = await this.ordersRepository.countRetryableOrders(buyerId, saleId);
    return retryableCount > 0 ? `${base}-r${retryableCount}` : base;
  }

  /**
   * Stripe authorize/capture path (FR-12):
   * 1. Reserve Redis unit (sold-out gate).
   * 2. Create PaymentIntent with capture_method=manual — authorises the card without
   *    charging. The PI id is stored as paymentRef so the webhook can find this order.
   * 3. Create the DB row (UNIQUE guard against double-click). On P2002 cancel the PI
   *    and release the Redis unit — the existing order wins.
   * 4. Publish in_progress so the buyer sees "Processing…" via Socket.IO immediately.
   * 5. Return clientSecret — the browser calls stripe.confirmCardPayment() which
   *    handles 3DS if required. No BullMQ job yet; the webhook enqueues it. The PI's
   *    metadata.traceparent carries this request's trace through to that later,
   *    otherwise-unrelated webhook request (see stripe-webhook.service.ts).
   *
   * Concurrency (.claude/rules/concurrency.md):
   * - Redis DECR is the sold-out gate — atomic, one buyer per unit. (FR-8, FR-15)
   * - UNIQUE(idempotency_key) deduplicates double-clicks: the loser cancels its PI
   *   and releases the extra Redis unit, then returns the winning idempotencyKey.
   * - The capture worker uses SELECT FOR UPDATE as the final stock authority (FR-15).
   *   Two simultaneous PIs in requires_capture: worker processes one at a time
   *   (concurrency=1); the second sees confirmed ≥ stockTotal and cancels its PI.
   */
  private async executeStripeOrder(
    dto: CreateOrderDto,
    idempotencyKey: string,
    priceCents: number,
  ): Promise<BuyResult> {
    const reserved = await this.inventory.reserveStock(dto.saleId, dto.quantity);
    if (!reserved) {
      throw new ConflictException(
        "All units are being checked out right now. Try again in a moment.",
      );
    }

    const traceCarrier: Record<string, string> = {};
    propagation.inject(context.active(), traceCarrier);

    let pi: Stripe.PaymentIntent;
    try {
      pi = await this.stripe.paymentIntents.create({
        amount: priceCents,
        currency: "usd",
        payment_method: dto.paymentMethodId,
        payment_method_types: ["card"],
        capture_method: "manual",
        ...(traceCarrier["traceparent"] && {
          metadata: { traceparent: traceCarrier["traceparent"] },
        }),
      });
    } catch (err) {
      await this.inventory.releaseStock(dto.saleId, dto.quantity);
      throw err;
    }

    let orderId: string;
    try {
      const created = await this.ordersRepository.createInProgressOrder(
        dto.buyerId,
        dto.saleId,
        idempotencyKey,
        pi.id,
      );
      orderId = created.orderId;
    } catch (e) {
      // P2002: double-click — cancel the PI we just created and release reservation.
      await this.stripe.paymentIntents.cancel(pi.id).catch(() => undefined);
      await this.inventory.releaseStock(dto.saleId, dto.quantity);
      if (isPrismaUniqueError(e)) return { status: "accepted", idempotencyKey };
      throw e;
    }

    await this.orderResultPublisher.publishOrderResult({
      buyerId: dto.buyerId,
      saleId: dto.saleId,
      status: ORDER_STATUSES.IN_PROGRESS,
      orderId,
    });

    return { status: "accepted", idempotencyKey, clientSecret: pi.client_secret ?? undefined };
  }
}
