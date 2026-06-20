import { PrismaClient, OrderStatus } from "../../generated/client/index.js";
import { OrderInspector } from "../concurrency/order-inspector.js";
import type { DrainTiming } from "../concurrency/order-inspector.js";

/** Extends concurrency inspector with confirmation-order query for FR-10 verification. */
export class ConfirmationOrderInspector {
  private readonly base: OrderInspector;

  constructor(private readonly prisma: PrismaClient) {
    this.base = new OrderInspector(prisma);
  }

  waitForQueueToDrain(saleId: string, expected: number): Promise<DrainTiming> {
    return this.base.waitForQueueToDrain(saleId, expected);
  }

  /** Returns buyerIds of confirmed orders sorted by createdAt ASC (= acceptance order). */
  async getConfirmedBuyerIds(saleId: string): Promise<string[]> {
    const orders = await this.prisma.order.findMany({
      where: { saleId, status: OrderStatus.confirmed },
      orderBy: { createdAt: "asc" },
      select: { buyerId: true },
    });
    return orders.map((o) => o.buyerId);
  }
}
