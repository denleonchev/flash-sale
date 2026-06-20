import { PrismaClient } from "../../generated/client/index.js";
import type { RunConfig } from "./config.js";

const TITLE_MARKER = "CONCURRENCY TEST —";
const HOUR_MS = 60 * 60 * 1000;

/** Wipes prior harness data and creates one fresh live sale to race against. */
export class SaleSeeder {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: RunConfig,
  ) {}

  async seedFreshSale(): Promise<string> {
    await this.wipePriorRuns();
    const sale = await this.prisma.sale.create({
      data: {
        title: `${TITLE_MARKER} ${new Date().toISOString()}`,
        stockTotal: this.config.stock,
        startsAt: new Date(Date.now() - HOUR_MS), // live: started, not yet ended
        endsAt: new Date(Date.now() + HOUR_MS),
      },
      select: { id: true },
    });
    // A new UUID each run → the Redis stock:<id> counter initialises clean, no stale value.
    return sale.id;
  }

  private async wipePriorRuns(): Promise<void> {
    const stale = await this.prisma.sale.findMany({
      where: { title: { startsWith: TITLE_MARKER } },
      select: { id: true },
    });
    if (stale.length === 0) return;
    const ids = stale.map((s) => s.id);
    // Orders FK-reference sales — delete them first.
    await this.prisma.order.deleteMany({ where: { saleId: { in: ids } } });
    await this.prisma.sale.deleteMany({ where: { id: { in: ids } } });
  }
}
