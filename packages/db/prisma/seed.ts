/**
 * Dev seed — 4 sales covering every SaleState (FR-2).
 *
 * Run after applying migrations:
 *   pnpm --filter @flash-sale/db exec tsx prisma/seed.ts
 *
 * Idempotent: deleteMany first so repeated runs stay clean.
 */
import { config } from "dotenv";
import path from "path";
import { PrismaClient } from "../generated/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";

config({ path: path.resolve(__dirname, "../../../.env") });

// Prisma 7 requires a driver adapter (NFR-8: URL from DATABASE_URL env var).
const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"]! });
const prisma = new PrismaClient({ adapter });

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

async function seed(): Promise<void> {
  // Clean slate so the seed is idempotent. FK order: fraudFlag → order → sale; users last.
  await prisma.fraudFlag.deleteMany();
  await prisma.order.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.user.deleteMany();

  const sales = await prisma.sale.createManyAndReturn({
    data: [
      {
        title: "Upcoming Drop — Vintage Watch",
        stockTotal: 10,
        priceCents: 29900,
        startsAt: new Date(Date.now() + DAY),
        endsAt: new Date(Date.now() + 2 * DAY),
      },
      {
        title: "Live Drop — Limited Sneakers",
        stockTotal: 5,
        priceCents: 14900,
        startsAt: new Date(Date.now() - HOUR),
        endsAt: new Date(Date.now() + HOUR),
      },
      {
        title: "Past Drop — Concert Tickets",
        stockTotal: 20,
        priceCents: 5900,
        startsAt: new Date(Date.now() - 2 * DAY),
        endsAt: new Date(Date.now() - DAY),
      },
      {
        title: "Sold-out Drop — Signed Poster",
        stockTotal: 0,
        priceCents: 9900,
        startsAt: new Date(Date.now() - HOUR),
        endsAt: new Date(Date.now() + HOUR),
      },
    ],
  });

  console.log("\nSeeded sales:");
  for (const s of sales) {
    console.log(`  ${s.id}  ${s.title}`);
    console.log(`    http://localhost:3000/sales/${s.id}`);
  }
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
