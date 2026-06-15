import { PrismaClient } from "../generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

export { PrismaClient } from "../generated/client";
export type { Sale, Order } from "../generated/client";

/** Creates a PrismaClient with the pg driver adapter. URL from DATABASE_URL env var. */
export function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] });
  return new PrismaClient({ adapter });
}
