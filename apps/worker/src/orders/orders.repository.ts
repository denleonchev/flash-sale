import { Injectable } from "@nestjs/common";
import type { OrderJobPayload } from "@flash-sale/shared";
import { PrismaService } from "../db/prisma.service.js";

/**
 * All prisma.db.* calls for the orders feature live here (worker CLAUDE.md layered
 * architecture). The finalizer and processor never import PrismaService directly.
 */
@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Inserts the confirmed order row and returns the post-commit remaining stock,
   * both inside one $transaction (read-your-writes: the count includes the row just
   * created, so the published remaining is exact). (FR-17, §4 steps 9–10)
   */
  async confirmOrderAndGetRemaining(job: OrderJobPayload): Promise<number> {
    return this.prisma.db.$transaction(async (tx) => {
      await tx.order.create({
        data: {
          saleId: job.saleId,
          buyerId: job.buyerId,
          idempotencyKey: job.idempotencyKey,
          status: "confirmed",
        },
      });
      return this.readRemainingStock(tx, job.saleId);
    });
  }

  /** Returns the existing order row. Used on the P2002 idempotency path. */
  async findOrderByIdempotencyKey(key: string) {
    return this.prisma.db.order.findUniqueOrThrow({
      where: { idempotencyKey: key },
    });
  }

  /**
   * Reads remaining stock outside a transaction. Safe only when the caller ensures
   * serialised access (concurrency=1 on the processor). (FR-17)
   */
  async getRemainingStock(saleId: string): Promise<number> {
    return this.readRemainingStock(this.prisma.db, saleId);
  }

  /** remaining = stockTotal − confirmed orders (§5). Returns 0 if the sale vanished. */
  private async readRemainingStock(
    client: Pick<PrismaService["db"], "sale">,
    saleId: string,
  ): Promise<number> {
    const sale = await client.sale.findUnique({
      where: { id: saleId },
      include: { _count: { select: { orders: { where: { status: "confirmed" } } } } },
    });
    if (!sale) return 0;
    return Math.max(0, sale.stockTotal - sale._count.orders);
  }
}
