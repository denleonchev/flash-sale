import { ConflictException, Injectable, Logger } from "@nestjs/common";
import Stripe from "stripe";
import {
  ORDER_STATUSES,
  SALE_STATES,
  type OrderResultUpdatedPayload,
  type Sale,
} from "@flash-sale/shared";

import { SalesService } from "../sales/sales.service.js";
import { UsersService } from "../users/users.service.js";
import { OrderProducer } from "./order.producer.js";
import { OrderResultPublisher } from "./order-result.publisher.js";
import { OrdersRepository } from "./orders.repository.js";
import { StockService } from "../stock/stock.service.js";
import type { CreateOrderDto } from "./dto/create-order.dto.js";

/** P2002 = unique constraint violation in Prisma. */
function isPrismaUniqueError(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002"
  );
}

export type BuyResult = { status: string; idempotencyKey: string; clientSecret?: string };

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  // Stripe is only instantiated when PAYMENT_PROVIDER=stripe. (FR-12)
  private readonly stripe =
    process.env["PAYMENT_PROVIDER"] === "stripe"
      ? new Stripe(process.env["STRIPE_SECRET_KEY"]!)
      : null;

  constructor(
    private readonly orderProducer: OrderProducer,
    private readonly orderResultPublisher: OrderResultPublisher,
    private readonly stockService: StockService,
    private readonly salesService: SalesService,
    private readonly ordersRepository: OrdersRepository,
    private readonly usersService: UsersService,
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
    return this.stripe
      ? this.executeStripeOrder(dto, idempotencyKey, sale.priceCents)
      : this.executeFakeOrder(dto, idempotencyKey, sale.priceCents);
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
    const failedCount = await this.ordersRepository.countFailedOrders(buyerId, saleId);
    return failedCount > 0 ? `${base}-r${failedCount}` : base;
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
   *    handles 3DS if required. No BullMQ job yet; the webhook enqueues it.
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
    const stripe = this.stripe!;

    const reserved = await this.stockService.reserveStock(dto.saleId, dto.quantity);
    if (!reserved) throw new ConflictException("sold out");

    let pi: Stripe.PaymentIntent;
    try {
      pi = await stripe.paymentIntents.create({
        amount: priceCents,
        currency: "usd",
        payment_method: dto.paymentMethodId,
        payment_method_types: ["card"],
        capture_method: "manual",
      });
    } catch (err) {
      await this.stockService.releaseStock(dto.saleId, dto.quantity);
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
      await stripe.paymentIntents.cancel(pi.id).catch(() => undefined);
      await this.stockService.releaseStock(dto.saleId, dto.quantity);
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

  /**
   * Concurrency (§4 plan, .claude/rules/concurrency.md):
   * - Redis DECR is the sold-out gate — atomic, before any DB write. (FR-8, FR-15)
   * - UNIQUE(idempotency_key) on INSERT is the double-click dedup: two concurrent
   *   requests both past findBlockingOrder race here; the loser gets P2002,
   *   releases its extra reservation, and returns accepted.
   * - Enqueue failure rolls back: deleteOrder + releaseStock so no orphan
   *   in_progress row is left without a job to resolve it.
   */
  private async executeFakeOrder(
    dto: CreateOrderDto,
    idempotencyKey: string,
    priceCents: number,
  ): Promise<BuyResult> {
    const reserved = await this.stockService.reserveStock(dto.saleId, dto.quantity);
    if (!reserved) {
      throw new ConflictException("sold out");
    }

    let orderId: string;
    try {
      const created = await this.ordersRepository.createInProgressOrder(
        dto.buyerId,
        dto.saleId,
        idempotencyKey,
      );
      orderId = created.orderId;
    } catch (e) {
      // P2002: double-click lost the INSERT race → release extra reservation.
      await this.stockService.releaseStock(dto.saleId, dto.quantity);
      if (isPrismaUniqueError(e)) return { status: "accepted", idempotencyKey };
      throw e;
    }

    try {
      await this.orderProducer.enqueueOrderJob(
        dto.saleId,
        dto.buyerId,
        idempotencyKey,
        dto.quantity,
        priceCents,
        dto.paymentMethodId,
      );
    } catch (err) {
      // Enqueue failed: orphan in_progress row would block all future retries.
      await this.ordersRepository.deleteOrder(orderId);
      await this.stockService.releaseStock(dto.saleId, dto.quantity);
      throw err;
    }

    await this.orderResultPublisher.publishOrderResult({
      buyerId: dto.buyerId,
      saleId: dto.saleId,
      status: ORDER_STATUSES.IN_PROGRESS,
      orderId,
    });

    return { status: "accepted", idempotencyKey };
  }
}
