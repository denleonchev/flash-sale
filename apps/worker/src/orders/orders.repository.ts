import { Injectable } from "@nestjs/common";
import type { OrderJobPayload } from "@flash-sale/shared";
import { OrderStatus } from "@flash-sale/db/client";
import { PrismaService } from "../db/prisma.service.js";

export interface GuardedOrderResult {
  readonly orderId: string;
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
   * Guarded UPDATE — the final authority on stock (§4 step 8, FR-15, NFR-1). In one
   * $transaction: lock the sale row (SELECT ... FOR UPDATE), count confirmed orders,
   * then transition this order in_progress → confirmed|sold_out only when
   * `WHERE status = in_progress` matches. The WHERE guard means a re-delivered job
   * (count===0) is safe: we read back the already-terminal row instead of writing again.
   *
   * Concurrency (.claude/rules/concurrency.md):
   * - The FOR UPDATE lock serialises confirmations for THIS sale so two buyers racing
   *   for the last unit are handled one after another — the DB can never exceed
   *   stockTotal regardless of the Redis counter.
   * - Idempotency (NFR-2): count===0 means the row is already terminal; we read back
   *   and republish without a second write. No INSERT P2002 path needed.
   */
  async confirmOrderGuarded(job: OrderJobPayload): Promise<GuardedOrderResult> {
    return this.prisma.db.$transaction(async (tx) => {
      // Row lock: any concurrent confirm for this sale blocks until we commit.
      const rows = await tx.$queryRaw<{ stock_total: number }[]>`
        SELECT stock_total FROM sales WHERE id = ${job.saleId} FOR UPDATE`;
      if (rows.length === 0) {
        throw new Error(`sale ${job.saleId} missing during confirm`);
      }
      const stockTotal = rows[0]!.stock_total;

      const confirmedCount = await tx.order.count({
        where: { saleId: job.saleId, status: OrderStatus.confirmed },
      });
      const targetStatus =
        confirmedCount < stockTotal ? OrderStatus.confirmed : OrderStatus.sold_out;

      // Guard: WHERE status = in_progress ensures at-most-once semantics on retry.
      const { count } = await tx.order.updateMany({
        where: {
          idempotencyKey: job.idempotencyKey,
          status: OrderStatus.in_progress,
        },
        data: { status: targetStatus },
      });

      if (count === 0) {
        // Already terminal (crash + BullMQ redelivery). Read back the existing row.
        const existing = await tx.order.findUniqueOrThrow({
          where: { idempotencyKey: job.idempotencyKey },
        });
        return {
          orderId: existing.id,
          status: existing.status,
          remaining: await this.readRemainingStock(tx, job.saleId),
        };
      }

      const updated = await tx.order.findUniqueOrThrow({
        where: { idempotencyKey: job.idempotencyKey },
        select: { id: true },
      });
      return {
        orderId: updated.id,
        status: targetStatus,
        remaining: await this.readRemainingStock(tx, job.saleId),
      };
    });
  }

  /**
   * Transitions the in_progress order to `failed`. The guard `WHERE status =
   * in_progress` makes this idempotent: a re-delivered job returns count=0 and
   * the caller skips the Redis release to avoid double-release. (FR-11, FR-16)
   *
   * Returns `{ count, orderId }`: count=1 means the transition happened (release
   * Redis); count=0 means already terminal (skip release).
   */
  async failOrder(
    job: OrderJobPayload,
  ): Promise<{ count: number; orderId: string }> {
    const { count } = await this.prisma.db.order.updateMany({
      where: {
        idempotencyKey: job.idempotencyKey,
        status: OrderStatus.in_progress,
      },
      data: { status: OrderStatus.failed },
    });
    const order = await this.prisma.db.order.findUniqueOrThrow({
      where: { idempotencyKey: job.idempotencyKey },
      select: { id: true },
    });
    return { count, orderId: order.id };
  }

  /** Returns the existing order row. Used on the count===0 idempotency path. */
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
