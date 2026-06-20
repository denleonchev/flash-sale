import { PrismaClient } from "../../generated/client/index.js";
import type { RunConfig } from "../concurrency/config.js";
import { SaleSeeder } from "../concurrency/sale-seeder.js";
import { SequentialSwarm } from "./sequential-swarm.js";
import { ConfirmationOrderInspector } from "./order-ordering-inspector.js";
import { OrderingResult } from "./result.js";

/** Orchestrates the ordering run: seed → sequential fire → drain → measure order → verdict. */
export class OrderingTestRunner {
  private readonly seeder: SaleSeeder;
  private readonly swarm: SequentialSwarm;
  private readonly inspector: ConfirmationOrderInspector;

  constructor(
    prisma: PrismaClient,
    private readonly config: RunConfig,
  ) {
    this.seeder = new SaleSeeder(prisma, config);
    this.swarm = new SequentialSwarm(config);
    this.inspector = new ConfirmationOrderInspector(prisma);
  }

  async run(): Promise<OrderingResult> {
    console.log(
      `\nOrdering test runner — K=${this.config.stock} sequential buyers, qty=${this.config.quantity}`,
    );
    console.log(`api: ${this.config.apiUrl}`);

    const saleId = await this.seeder.seedFreshSale();
    console.log(`seeded live sale ${saleId}`);

    const { buyerIds: acceptedBuyerIds, errors } = await this.swarm.fireSequentialBuys(saleId);
    if (errors > 0) {
      console.warn(`${errors} buy(s) returned errors — is the api running?`);
    }
    console.log(`acceptance order  : ${acceptedBuyerIds.join(", ")}`);

    await this.inspector.waitForQueueToDrain(saleId, acceptedBuyerIds.length);
    const confirmedBuyerIds = await this.inspector.getConfirmedBuyerIds(saleId);

    return new OrderingResult(acceptedBuyerIds, confirmedBuyerIds);
  }
}
