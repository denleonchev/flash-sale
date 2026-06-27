import { PrismaClient } from "../../generated/client/index.js";
import type { RunConfig } from "./config.js";
import { SaleSeeder } from "./sale-seeder.js";
import { StripeBuyerSwarm } from "./stripe-buyer-swarm.js";
import { WebhookPoster } from "./webhook-poster.js";
import { OrderInspector } from "./order-inspector.js";
import { ConcurrencyResult } from "./result.js";

export class ConcurrencyTestRunner {
  private readonly seeder: SaleSeeder;
  private readonly swarm: StripeBuyerSwarm;
  private readonly webhookPoster: WebhookPoster;
  private readonly inspector: OrderInspector;

  constructor(
    prisma: PrismaClient,
    private readonly config: RunConfig,
  ) {
    this.seeder = new SaleSeeder(prisma, config);
    this.swarm = new StripeBuyerSwarm(config);
    this.webhookPoster = new WebhookPoster(config);
    this.inspector = new OrderInspector(prisma);
  }

  async run(): Promise<ConcurrencyResult> {
    console.log(
      `\nStripe concurrency test — K=${this.config.stock} stock, N=${this.config.buyers} buyers`,
    );
    console.log(`api: ${this.config.apiUrl}`);

    const saleId = await this.seeder.seedFreshSale();
    console.log(`seeded live sale ${saleId}`);

    const swarmReport = await this.swarm.fireConcurrentBuys(saleId);
    console.log(
      `swarm done: ${swarmReport.accepted.length} accepted, ${swarmReport.rejected} rejected, ${swarmReport.errors} errors`,
    );

    // Post webhooks concurrently — all PIs race into the worker simultaneously.
    // This is the load that exercises SELECT FOR UPDATE. (concurrency.md)
    await this.webhookPoster.confirmAndPostAll(swarmReport.accepted);
    console.log(`webhooks posted for ${swarmReport.accepted.length} PIs`);

    const timing = await this.inspector.waitForSettlement(saleId, swarmReport.accepted.length);
    const snapshot = await this.inspector.takeSnapshot(saleId);

    return new ConcurrencyResult(this.config, swarmReport, snapshot, timing);
  }
}
