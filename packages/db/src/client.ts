import { PrismaClient, Prisma } from "../generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

export { PrismaClient } from "../generated/client";
export type { Sale, Order } from "../generated/client";

/**
 * Creates a PrismaClient with the pg driver adapter. URL from DATABASE_URL env var.
 *
 * Per-statement query timing is opt-in via PRISMA_LOG_QUERIES=1 (NFR-8: behaviour
 * from env). Off → events are emitted but unobserved, so nothing prints. Use it to
 * see which statement (e.g. COMMIT) dominates a slow transaction.
 */
export function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] });
  const client = new PrismaClient({
    adapter,
    log: [{ emit: "event", level: "query" }],
  });

  if (process.env["PRISMA_LOG_QUERIES"] === "1") {
    client.$on("query", (e: Prisma.QueryEvent) => {
      console.log(`[prisma] ${e.duration}ms  ${e.query}`);
    });
  }

  return client;
}
