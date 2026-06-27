import { PrismaClient } from "../../generated/client/index.js";

export interface OrderSnapshot {
  confirmed: number;
  soldOut: number;
  failed: number;
  inProgress: number;
}

export interface WaitTiming {
  waitMs: number;
  timedOut: boolean;
}

export class OrderInspector {
  constructor(private readonly prisma: PrismaClient) {}

  // Poll until all accepted orders leave in_progress, or timeout.
  async waitForSettlement(
    saleId: string,
    expectedSettled: number,
    timeoutMs = 30_000,
  ): Promise<WaitTiming> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const snap = await this.takeSnapshot(saleId);
      if (snap.confirmed + snap.soldOut + snap.failed >= expectedSettled) {
        return { waitMs: Date.now() - start, timedOut: false };
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    return { waitMs: timeoutMs, timedOut: true };
  }

  async takeSnapshot(saleId: string): Promise<OrderSnapshot> {
    const rows = await this.prisma.order.groupBy({
      by: ["status"],
      where: { saleId },
      _count: true,
    });
    const count = (s: string) => rows.find((r) => r.status === s)?._count ?? 0;
    return {
      confirmed: count("confirmed"),
      soldOut: count("sold_out"),
      failed: count("failed"),
      inProgress: count("in_progress"),
    };
  }
}
