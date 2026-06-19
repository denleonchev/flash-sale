import { Injectable } from "@nestjs/common";
import { ORDER_STATUSES, type OrderResultUpdatedPayload, type OrderStatus } from "@flash-sale/shared";
import { PrismaService } from "../db/prisma.service.js";

/** Statuses that generate a reconnect snapshot (FR-19). failed is excluded — it allows retry. */
const SNAPSHOT_STATUSES: OrderStatus[] = [ORDER_STATUSES.CONFIRMED, ORDER_STATUSES.SOLD_OUT];

/** Raw DB access for orders. No business logic — returns Prisma rows as-is. */
@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the first confirmed or sold_out order for this buyer+sale, or null.
   * Used to block re-purchase when the buyer already has a successful outcome.
   * Failed orders are intentionally excluded — they allow retry. (FR-14)
   */
  findSuccessfulOrder(
    buyerId: string,
    saleId: string,
  ): Promise<{ status: string; idempotencyKey: string } | null> {
    return this.prisma.db.order.findFirst({
      where: { buyerId, saleId, status: { not: ORDER_STATUSES.FAILED } },
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
   * Last unacknowledged confirmed/sold_out order for a buyer on one sale.
   * Used to push a snapshot on (re)subscribe (FR-19). Returns null if none exists
   * or if the buyer has already acknowledged the result (acknowledgedAt is set).
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
