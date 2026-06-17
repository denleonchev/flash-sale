import { Injectable } from "@nestjs/common";
import { ORDER_STATUS_VALUES, type OrderResultUpdatedPayload } from "@flash-sale/shared";
import { PrismaService } from "../db/prisma.service.js";

/** Raw DB access for orders. No business logic — returns Prisma rows as-is. */
@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the order matching the idempotency key, or null if not found. */
  findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<{ status: string } | null> {
    return this.prisma.db.order.findUnique({
      where: { idempotencyKey },
      select: { status: true },
    });
  }

  /**
   * Last finalized order for a buyer (any sale), ordered by `createdAt desc`.
   * Used to push a snapshot on socket reconnect (FR-19). Returns null if no
   * finalized order exists yet.
   */
  async getLatestFinalizedOrder(
    buyerId: string,
  ): Promise<OrderResultUpdatedPayload | null> {
    const row = await this.prisma.db.order.findFirst({
      where: { buyerId, status: { in: ORDER_STATUS_VALUES } },
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
