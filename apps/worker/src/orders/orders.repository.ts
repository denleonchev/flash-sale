import { Injectable } from "@nestjs/common";
import { OrderStatus } from "@flash-sale/db/client";
import { PrismaService } from "../db/prisma.service.js";

export interface CaptureGuardedResult {
  readonly orderId: string;
  readonly status: OrderStatus;
  readonly remainingStock: number;
  /** true when this call made the transition (not a retry). Used to gate Redis release. */
  readonly didTransition: boolean;
}

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Guarded capture/cancel decision for the authorize/capture flow (FR-12).
   *
   * Concurrency (concurrency.md):
   * - SELECT FOR UPDATE on the sale row serialises concurrent capture jobs for
   *   the same sale — the DB is the final authority on stock. (FR-15, NFR-1)
   * - WHERE status = in_progress makes both paths idempotent on BullMQ retry.
   *   count=0 → already terminal; we read back the row and republish.
   * - didTransition=true gates the Redis INCRBY release on the sold_out path
   *   so a retry never double-releases. (NFR-2)
   */
  async decideCaptureOrCancel(orderId: string, saleId: string): Promise<CaptureGuardedResult> {
    return this.prisma.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ stock_total: number }[]>`
        SELECT stock_total FROM sales WHERE id = ${saleId} FOR UPDATE`;
      if (rows.length === 0) throw new Error(`sale ${saleId} missing during capture`);
      const stockTotal = rows[0]!.stock_total;

      const confirmedCount = await tx.order.count({
        where: { saleId, status: OrderStatus.confirmed },
      });

      const targetStatus =
        confirmedCount < stockTotal ? OrderStatus.confirmed : OrderStatus.sold_out;

      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.in_progress },
        data: { status: targetStatus },
      });

      const remainingStock =
        targetStatus === OrderStatus.confirmed ? Math.max(0, stockTotal - confirmedCount - 1) : 0;

      return {
        orderId,
        status: targetStatus,
        remainingStock,
        didTransition: count > 0,
      };
    });
  }
}
