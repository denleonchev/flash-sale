import { Injectable } from "@nestjs/common";
import {
  ORDER_STATUSES,
  type OrderResultUpdatedPayload,
  type OrderStatus,
} from "@flash-sale/shared";
import { PrismaService } from "../db/prisma.service.js";

/** Statuses that block a re-purchase attempt. failed is excluded — it allows retry. (FR-14) */
const BLOCKING_STATUSES: OrderStatus[] = [
  ORDER_STATUSES.IN_PROGRESS,
  ORDER_STATUSES.CONFIRMED,
  ORDER_STATUSES.SOLD_OUT,
];

/** Statuses included in the reconnect snapshot (FR-19). failed excluded — it allows retry. */
const SNAPSHOT_STATUSES: OrderStatus[] = [
  ORDER_STATUSES.IN_PROGRESS,
  ORDER_STATUSES.CONFIRMED,
  ORDER_STATUSES.SOLD_OUT,
];

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Failed orders excluded — they allow retry. (FR-14) */
  findBlockingOrder(
    buyerId: string,
    saleId: string,
  ): Promise<{ status: string; idempotencyKey: string } | null> {
    return this.prisma.db.order.findFirst({
      where: { buyerId, saleId, status: { in: BLOCKING_STATUSES } },
      select: { status: true, idempotencyKey: true },
    });
  }

  countFailedOrders(buyerId: string, saleId: string): Promise<number> {
    return this.prisma.db.order.count({
      where: { buyerId, saleId, status: ORDER_STATUSES.FAILED },
    });
  }

  /**
   * UNIQUE(idempotency_key) is the double-click dedup point: two concurrent requests
   * both past `findBlockingOrder` race here; the loser gets P2002, caller releases the
   * extra reservation. (FR-9, FR-14, §4 step 4)
   *
   * NFR-3: hot-path INSERT is intentional — light indexed write, not slow payment work;
   * durable row enables FR-19 reconnect recovery of "processing" state.
   */
  async createInProgressOrder(
    buyerId: string,
    saleId: string,
    idempotencyKey: string,
    paymentRef?: string,
  ): Promise<{ orderId: string }> {
    const order = await this.prisma.db.order.create({
      data: { buyerId, saleId, idempotencyKey, status: "in_progress", paymentRef },
      select: { id: true },
    });
    return { orderId: order.id };
  }

  /** Rollback when PI creation or linking fails — orphan row blocks re-purchase forever. (§4 step 5) */
  deleteOrder(orderId: string): Promise<unknown> {
    return this.prisma.db.order.delete({ where: { id: orderId } });
  }

  /** Includes in_progress so a reconnecting buyer recovers "your order is processing". (FR-19) */
  async getLatestFinalizedOrder(
    buyerId: string,
    saleId: string,
  ): Promise<OrderResultUpdatedPayload | null> {
    const row = await this.prisma.db.order.findFirst({
      where: {
        buyerId,
        saleId,
        status: { in: SNAPSHOT_STATUSES },
        acknowledgedAt: null,
      },
      select: { id: true, saleId: true, status: true },
      orderBy: { createdAt: "desc" },
    });
    if (!row) return null;
    return {
      orderId: row.id,
      saleId: row.saleId,
      status: row.status as OrderResultUpdatedPayload["status"],
    };
  }

  acknowledgeOrderResult(orderId: string): Promise<unknown> {
    return this.prisma.db.order.update({
      where: { id: orderId, acknowledgedAt: null },
      data: { acknowledgedAt: new Date() },
    });
  }

  /** FR-12: webhook looks up the in_progress order that matches the captured PI. */
  findInProgressOrderByPaymentRef(paymentRef: string): Promise<{
    id: string;
    saleId: string;
    buyerId: string;
    idempotencyKey: string;
  } | null> {
    return this.prisma.db.order.findFirst({
      where: { paymentRef, status: "in_progress" },
      select: { id: true, saleId: true, buyerId: true, idempotencyKey: true },
    });
  }

  /**
   * Transitions in_progress → failed. (FR-12 webhook: payment_intent.payment_failed)
   * WHERE guard makes it idempotent on Stripe webhook retry.
   */
  async failFromWebhook(orderId: string): Promise<{ transitioned: boolean }> {
    const { count } = await this.prisma.db.order.updateMany({
      where: { id: orderId, status: "in_progress" },
      data: { status: "failed" },
    });
    return { transitioned: count > 0 };
  }
}
