import { Injectable } from "@nestjs/common";
import type { OrderJobPayload } from "@flash-sale/shared";
import { OrderStatus } from "@flash-sale/db/client";
import { PrismaService } from "../db/prisma.service.js";

export interface GuardedOrderResult {
  readonly status: OrderStatus;
  readonly remaining: number;
}

/**
 * All prisma.db.* calls for the orders feature live here (worker CLAUDE.md layered
 * architecture). The finalizer and processor never import PrismaService directly.
 */
@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Guarded write — the final authority on stock (§4 step 8, FR-15, NFR-1). In one
   * $transaction: lock the sale row (SELECT ... FOR UPDATE), then confirm the order
   * only if confirmed < stockTotal; otherwise record it `sold_out`. The lock
   * serialises confirmations for THIS sale, so two buyers racing for the last unit
   * are handled one after another and the DB can never exceed stockTotal — even if
   * the Redis reserve over-counts. Returns the terminal status and the post-write
   * remaining (read-your-writes inside the same tx). See .claude/rules/concurrency.md.
   */
  async createGuardedOrder(job: OrderJobPayload): Promise<GuardedOrderResult> {
    return this.prisma.db.$transaction(async (tx) => {
      // Row lock: any concurrent confirm for this sale blocks until we commit.
      const rows = await tx.$queryRaw<{ stock_total: number }[]>`
        SELECT stock_total FROM sales WHERE id = ${job.saleId} FOR UPDATE`;
      if (rows.length === 0) {
        // The reservation in §4 step 3 ran against this sale, so it must exist.
        throw new Error(`sale ${job.saleId} missing during confirm`);
      }
      const stockTotal = rows[0]!.stock_total;

      const confirmedOrdersNumber = await tx.order.count({
        where: { saleId: job.saleId, status: OrderStatus.confirmed },
      });
      const status =
        confirmedOrdersNumber < stockTotal
          ? OrderStatus.confirmed
          : OrderStatus.sold_out;

      await tx.order.create({
        data: {
          saleId: job.saleId,
          buyerId: job.buyerId,
          idempotencyKey: job.idempotencyKey,
          status,
        },
      });
      return {
        status,
        remaining: await this.readRemainingStock(tx, job.saleId),
      };
    });
  }

  /**
   * Creates a failed order row — no row lock needed because a `failed` order
   * does not claim stock (remaining = stockTotal − confirmed only). (FR-11)
   */
  async createFailedOrder(job: OrderJobPayload): Promise<void> {
    await this.prisma.db.order.create({
      data: {
        saleId: job.saleId,
        buyerId: job.buyerId,
        idempotencyKey: job.idempotencyKey,
        status: OrderStatus.failed,
      },
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
      include: {
        _count: { select: { orders: { where: { status: "confirmed" } } } },
      },
    });
    if (!sale) return 0;
    return Math.max(0, sale.stockTotal - sale._count.orders);
  }
}
