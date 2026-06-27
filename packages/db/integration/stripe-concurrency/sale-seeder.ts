import { PrismaClient } from "../../generated/client/index.js";
import type { RunConfig } from "./config.js";

export class SaleSeeder {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: RunConfig,
  ) {}

  async seedFreshSale(): Promise<string> {
    const now = new Date();
    const sale = await this.prisma.sale.create({
      data: {
        title: `Stripe concurrency test ${now.toISOString()}`,
        stockTotal: this.config.stock,
        priceCents: 1000,
        startsAt: new Date(now.getTime() - 60_000),
        endsAt: new Date(now.getTime() + 3_600_000),
      },
      select: { id: true },
    });
    return sale.id;
  }
}
