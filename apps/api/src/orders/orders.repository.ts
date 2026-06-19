import { Injectable } from "@nestjs/common";
import { ORDER_STATUSES, ORDER_STATUS_VALUES, type OrderResultUpdatedPayload } from "@flash-sale/shared";
import { PrismaService } from "../db/prisma.service.js";

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
   * Last finalized order for a buyer on one sale, ordered by `createdAt desc`.
   * Used to push a snapshot on (re)subscribe so a reconnected client recovers its
   * own result for the sale it is viewing (FR-19). Returns null if none exists yet.
   */
  async getLatestFinalizedOrder(
    buyerId: string,
    saleId: string,
  ): Promise<OrderResultUpdatedPayload | null> {
    const row = await this.prisma.db.order.findFirst({
      where: { buyerId, saleId, status: { in: ORDER_STATUS_VALUES } },
      select: { saleId: true, status: true },
      orderBy: { createdAt: "desc" },
    });
    if (!row) return null;
    return {
      saleId: row.saleId,
      status: row.status as OrderResultUpdatedPayload["status"],
    };
  }
}
