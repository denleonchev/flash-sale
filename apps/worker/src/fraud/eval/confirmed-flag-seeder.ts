import { FRAUD_FLAG_STATUSES } from "@flash-sale/shared";
import type { PrismaService } from "../../db/prisma.service.js";
import type { EmbeddingService } from "../../embeds/embedding.service.js";
import { CONFIRMED_FLAG_SEEDS, type ConfirmedFlagSeed } from "./fraud-eval.seeds.js";

const EVAL_SALE_ID = "00000000-0000-4000-8000-0000000fe000";
const EVAL_BUYER_ID = "fraud-eval-seed-buyer";
const LOCAL_HOSTS = ["localhost", "127.0.0.1"];

export class ConfirmedFlagSeeder {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async seedConfirmedFlags(): Promise<void> {
    this.assertLocalDatabase();
    await this.removeSeededFlags();
    await this.createSale();
    for (const [index, seed] of CONFIRMED_FLAG_SEEDS.entries()) {
      const flagId = await this.createConfirmedFlag(seed, index);
      await this.storeEmbedding(flagId, seed.pattern);
    }
  }

  async removeSeededFlags(): Promise<void> {
    this.assertLocalDatabase();
    await this.prisma.db.fraudFlag.deleteMany({ where: { saleId: EVAL_SALE_ID } });
    await this.prisma.db.order.deleteMany({ where: { saleId: EVAL_SALE_ID } });
    await this.prisma.db.sale.deleteMany({ where: { id: EVAL_SALE_ID } });
  }

  private assertLocalDatabase(): void {
    const host = new URL(process.env["DATABASE_URL"] ?? "").hostname;
    if (!LOCAL_HOSTS.includes(host)) {
      throw new Error(`fraud eval only runs against a local database, got host "${host}"`);
    }
  }

  private async createSale(): Promise<void> {
    await this.prisma.db.sale.create({
      data: {
        id: EVAL_SALE_ID,
        title: "Fraud eval seed sale",
        stockTotal: CONFIRMED_FLAG_SEEDS.length,
        priceCents: 100,
        startsAt: new Date(0),
        endsAt: new Date(0),
      },
    });
  }

  private async createConfirmedFlag(seed: ConfirmedFlagSeed, index: number): Promise<string> {
    const order = await this.prisma.db.order.create({
      data: {
        saleId: EVAL_SALE_ID,
        buyerId: EVAL_BUYER_ID,
        idempotencyKey: `fraud-eval-seed-${index}`,
        status: "confirmed",
      },
      select: { id: true },
    });
    const flag = await this.prisma.db.fraudFlag.create({
      data: {
        orderId: order.id,
        buyerId: EVAL_BUYER_ID,
        saleId: EVAL_SALE_ID,
        risk: seed.risk,
        reason: seed.reason,
        pattern: seed.pattern,
        status: FRAUD_FLAG_STATUSES.CONFIRMED,
      },
      select: { id: true },
    });
    return flag.id;
  }

  private async storeEmbedding(flagId: string, pattern: string): Promise<void> {
    const vector = await this.embeddingService.embed(pattern);
    const vectorStr = `[${vector.join(",")}]`;
    await this.prisma.db.$executeRaw`
      UPDATE fraud_flags SET embedding = ${vectorStr}::vector WHERE id = ${flagId}
    `;
  }
}
