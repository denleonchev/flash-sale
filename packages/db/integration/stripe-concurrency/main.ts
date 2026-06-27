/**
 * Stripe concurrency harness — proves no oversell under the authorize/capture flow
 * (NFR-1, FR-12). Entry point.
 *
 * INTEGRATION test: drives the real api + Stripe test-mode + BullMQ + worker + Postgres
 * together. Asserts confirmed == K with N > K concurrent buyers — no RPS/latency metrics.
 *
 * Run (human — boundaries.md: hits the live stack + external Stripe/Redis/Postgres):
 *   1. .env filled, api (:3001) and worker running, STRIPE_SECRET_KEY is a test-mode key.
 *   2. CONCURRENCY_STOCK=5 CONCURRENCY_BUYERS=50 \
 *        pnpm --filter @flash-sale/db test:integration:stripe-concurrency
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
