import { PrismaClient } from "../../generated/client/index.js";
import type { RunConfig } from "./config.js";
import { SaleSeeder } from "./sale-seeder.js";
import { BuyerSwarm } from "./buyer-swarm.js";
import { OrderInspector } from "./order-inspector.js";
import { ConcurrencyResult } from "./result.js";

/** Orchestrates the run: seed → fire the race → wait → measure → verdict. */
export class ConcurrencyTestRunner {
  private readonly seeder: SaleSeeder;
  private readonly swarm: BuyerSwarm;
  private readonly inspector: OrderInspector;

  constructor(
    prisma: PrismaClient,
    private readonly config: RunConfig,
  ) {
    this.seeder = new SaleSeeder(prisma, config);
    this.swarm = new BuyerSwarm(config);
    this.inspector = new OrderInspector(prisma);
  }

  async run(): Promise<ConcurrencyResult> {
    console.log(
      `\nConcurrency test runner — K=${this.config.stock} stock, ` +
        `N=${this.config.buyers} buyers, qty=${this.config.quantity}`,
    );
    console.log(`api: ${this.config.apiUrl}`);

    const saleId = await this.seeder.seedFreshSale();
    console.log(`seeded live sale ${saleId}`);

    const swarmReport = await this.swarm.fireConcurrentBuys(saleId);
    // Each accepted reservation enqueues one job → expect that many confirmations.
    const timing = await this.inspector.waitForQueueToDrain(saleId, swarmReport.accepted);
    const snapshot = await this.inspector.takeSnapshot(saleId);

    return new ConcurrencyResult(this.config, swarmReport, snapshot, timing);
  }
}
