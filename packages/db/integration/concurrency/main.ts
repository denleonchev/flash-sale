/**
 * Integration concurrency harness — proves no oversell (NFR-1, card S-E0.5). Entry point.
 *
 * INTEGRATION test of concurrent correctness, not a load test: it drives the real
 * api + Redis + BullMQ + worker + Postgres together and asserts a boolean invariant
 * (confirmed == K, no duplicate buyer) under N>K simultaneous buyers — no RPS/latency
 * metrics. Not e2e: the web/UI layer is not involved (we POST straight to the api,
 * which trusts buyerId since Auth0 lives in the web BFF).
 *
 * Run (human — boundaries.md: hits the live stack + external Redis/Postgres):
 *   1. migrations applied, .env filled, api (:3001) and worker running,
 *      no artificial delay in apps/worker/src/orders/order.finalizer.ts.
 *   2. CONCURRENCY_STOCK=5 CONCURRENCY_BUYERS=50 \
 *        pnpm --filter @flash-sale/db test:integration:concurrency
 *
 * One class per file: SaleSeeder (DB setup), BuyerSwarm (the HTTP race), OrderInspector
 * (authoritative Postgres reads), ConcurrencyResult (verdict + report), ConcurrencyTestRunner
 * (orchestration). This file only wires dependencies and sets the exit code.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
import { PrismaClient } from "../../generated/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { loadRunConfig } from "./config.js";
import { ConcurrencyTestRunner } from "./concurrency-test-runner.js";

loadEnv({ path: path.resolve(__dirname, "../../../../.env") });

async function main(): Promise<void> {
  const config = loadRunConfig();
  // Prisma 7 requires a driver adapter (NFR-8: URL from DATABASE_URL env var).
  const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"]! });
  const prisma = new PrismaClient({ adapter });

  try {
    const result = await new ConcurrencyTestRunner(prisma, config).run();
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
