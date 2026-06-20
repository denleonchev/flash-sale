/**
 * Integration ordering harness — proves orders are confirmed in acceptance order
 * (FR-10, card S-4.3). Entry point.
 *
 * Run (human — boundaries.md: hits the live stack + external Redis/Postgres):
 *   1. migrations applied, .env filled, api (:3001) and worker running, PAYMENT_FAIL_RATE=0.
 *   2. CONCURRENCY_STOCK=3 PAYMENT_FAIL_RATE=0 \
 *        pnpm --filter @flash-sale/db test:integration:ordering
 */
import { config as loadEnv } from "dotenv";
import path from "path";
import { PrismaClient } from "../../generated/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { loadRunConfig } from "../concurrency/config.js";
import { OrderingTestRunner } from "./ordering-test-runner.js";

loadEnv({ path: path.resolve(__dirname, "../../../../.env") });

async function main(): Promise<void> {
  const config = loadRunConfig();
  const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"]! });
  const prisma = new PrismaClient({ adapter });

  try {
    const result = await new OrderingTestRunner(prisma, config).run();
    result.print();
    process.exitCode = result.passed ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
