import { Injectable } from "@nestjs/common";
import { ORDER_STATUSES, type OrderResultUpdatedPayload, type OrderStatus } from "@flash-sale/shared";
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

/** Raw DB access for orders. No business logic — returns Prisma rows as-is. */
@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the first in_progress, confirmed, or sold_out order for this buyer+sale, or null.
   * Used to block re-purchase. Failed orders are intentionally excluded — they allow retry. (FR-14)
   */
  findBlockingOrder(
    buyerId: string,
    saleId: string,
  ): Promise<{ status: string; idempotencyKey: string } | null> {
    return this.prisma.db.order.findFirst({
      where: { buyerId, saleId, status: { in: BLOCKING_STATUSES } },
      select: { status: true, idempotencyKey: true },
    });
  }

  /** How many failed attempts this buyer has on this sale — used to generate the next retry key. */
  countFailedOrders(buyerId: string, saleId: string): Promise<number> {
    return this.prisma.db.order.count({
      where: { buyerId, saleId, status: ORDER_STATUSES.FAILED },
    });
  }

  /**
   * Creates an order row with status `in_progress` before the job is enqueued.
   * The UNIQUE(idempotency_key) constraint is the atomic dedup point for double-clicks:
   * two concurrent requests both past `findBlockingOrder` race here and one gets P2002.
   * The caller catches P2002 and releases the extra reservation. (FR-9, FR-14, §4 step 4)
   *
   * // NFR-3: hot-path INSERT is intentional — it's a light indexed write, not slow
   * // payment work; the durable row enables FR-19 reconnect recovery of "processing" state.
   */
  async createInProgressOrder(
    buyerId: string,
    saleId: string,
    idempotencyKey: string,
  ): Promise<{ orderId: string }> {
    const order = await this.prisma.db.order.create({
      data: { buyerId, saleId, idempotencyKey, status: "in_progress" },
      select: { id: true },
    });
    return { orderId: order.id };
  }

  /**
   * Deletes the order row by PK. Used as rollback when enqueue fails after a
   * successful INSERT — an orphan in_progress row without a job would permanently
   * block re-purchase and never resolve. (§4 step 5 rollback)
   */
  deleteOrder(orderId: string): Promise<unknown> {
    return this.prisma.db.order.delete({ where: { id: orderId } });
  }

  /**
   * Last unacknowledged non-failed order for a buyer on one sale.
   * Includes in_progress so a reconnecting buyer recovers "your order is processing"
   * (FR-19). Returns null if all results have been acknowledged (acknowledgedAt is set).
   */
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

  /** Mark the exact order row as acknowledged by PK (FR-19). */
  acknowledgeOrderResult(orderId: string): Promise<unknown> {
    return this.prisma.db.order.update({
      where: { id: orderId, acknowledgedAt: null },
      data: { acknowledgedAt: new Date() },
    });
  }
}
