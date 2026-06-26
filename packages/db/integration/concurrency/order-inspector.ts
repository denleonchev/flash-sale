import { PrismaClient, OrderStatus } from "../../generated/client/index.js";

const DRAIN_POLL_MS = 250;
const DRAIN_TIMEOUT_MS = 30_000;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export interface OrderSnapshot {
  readonly confirmed: number;
  readonly duplicateBuyers: number;
}

/** Timing of the drain, measured from the start of the wait (±DRAIN_POLL_MS resolution). */
export interface DrainTiming {
  readonly firstConfirmMs: number | null; // until confirmed first went > 0
  readonly drainMs: number | null; // until confirmed reached expected (null = timed out)
}

/**
 * All authoritative reads of order state against Postgres (the source of truth,
 * stockTotal − confirmed). Schema-coupled queries live ONLY here. Reads the raw
 * confirmed-row count on purpose: the api's `remainingStock` is clamped with
 * Math.max(0, …) and would hide an oversell.
 */
export class OrderInspector {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Wait until every accepted reservation has been confirmed by the worker, or until
   * timeout. `expectedConfirmed` is the number of accepted buys: each one enqueues
   * exactly one job → one confirmed row, so the queue has drained when confirmed
   * reaches it. (A plain "count stopped changing" check is wrong here — right after
   * the burst the count is 0 and trivially "stable", so we'd measure before the
   * worker even starts.) On timeout we fall through; the snapshot still asserts —
   * confirmed short of expected means the worker is down/slow or a job failed.
   */
  async waitForQueueToDrain(saleId: string, expectedConfirmed: number): Promise<DrainTiming> {
    const start = Date.now();
    const deadline = start + DRAIN_TIMEOUT_MS;
    let firstConfirmMs: number | null = null;

    while (Date.now() < deadline) {
      const confirmed = await this.countConfirmed(saleId);
      if (firstConfirmMs === null && confirmed > 0) firstConfirmMs = Date.now() - start;
      if (confirmed >= expectedConfirmed) {
        return { firstConfirmMs, drainMs: Date.now() - start };
      }
      await sleep(DRAIN_POLL_MS);
    }
    return { firstConfirmMs, drainMs: null }; // timed out
  }

  /** One consistent, parallel read of the two independent facts we assert on. */
  async takeSnapshot(saleId: string): Promise<OrderSnapshot> {
    const [confirmed, duplicateBuyers] = await Promise.all([
      this.countConfirmed(saleId),
      this.countDuplicateBuyers(saleId),
    ]);
    return { confirmed, duplicateBuyers };
  }

  private countConfirmed(saleId: string): Promise<number> {
    return this.prisma.order.count({
      where: { saleId, status: OrderStatus.confirmed },
    });
  }

  private async countDuplicateBuyers(saleId: string): Promise<number> {
    const groups = await this.prisma.order.groupBy({
      by: ["buyerId"],
      where: { saleId, status: OrderStatus.confirmed },
      _count: { buyerId: true },
      having: { buyerId: { _count: { gt: 1 } } },
    });
    return groups.length;
  }
}
