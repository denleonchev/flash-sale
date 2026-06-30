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
import { Queue } from "bullmq";
import { PrismaClient } from "../generated/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";

config({ path: path.resolve(__dirname, "../../../.env") });

// Prisma 7 requires a driver adapter (NFR-8: URL from DATABASE_URL env var).
const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"]! });
const prisma = new PrismaClient({ adapter });

const EMBED_SALE_QUEUE = "embed-sales";
const EMBED_SALE_JOB = "embed-sale";

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
        description:
          "A rare antique timepiece from the 1960s. Classic old-school design, mechanical movement, collectible wristwatch for horology enthusiasts.",
        stockTotal: 10,
        priceCents: 29900,
        startsAt: new Date(Date.now() + DAY),
        endsAt: new Date(Date.now() + 2 * DAY),
      },
      {
        title: "Live Drop — Limited Sneakers",
        description:
          "Exclusive limited-edition athletic shoes. Streetwear sneakers with unique colorway, hyped footwear drop for collectors and fashion enthusiasts.",
        stockTotal: 100,
        priceCents: 14900,
        startsAt: new Date(Date.now() - HOUR),
        endsAt: new Date(Date.now() + 60 * DAY),
      },
      {
        title: "Live Drop — Wireless Noise-Cancelling Headphones",
        description:
          "Over-ear headphones with active noise cancellation, 40-hour battery life, and Bluetooth 5.3. Limited drop — once they're gone, they're gone.",
        stockTotal: 100,
        priceCents: 14900,
        startsAt: new Date(Date.now() - HOUR),
        endsAt: new Date(Date.now() + 2 * 80 * DAY),
      },
      {
        title: "Past Drop — Concert Tickets",
        description:
          "Tickets to a live music concert event. Front-row seats for a band performance, show, gig — an unforgettable live entertainment experience.",
        stockTotal: 20,
        priceCents: 5900,
        startsAt: new Date(Date.now() - 2 * DAY),
        endsAt: new Date(Date.now() - DAY),
      },
      {
        title: "Sold-out Drop — Signed Poster",
        description:
          "Hand-signed art print autographed by the artist. Memorabilia poster, framed collectible artwork, limited edition signed merchandise.",
        stockTotal: 0,
        priceCents: 9900,
        startsAt: new Date(Date.now() - HOUR),
        endsAt: new Date(Date.now() + HOUR),
      },
    ],
  });

  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) throw new Error("REDIS_URL is not set");

  const embedQueue = new Queue(EMBED_SALE_QUEUE, {
    connection: { url: redisUrl },
  });

  await Promise.all(
    sales.map((s) =>
      embedQueue.add(
        EMBED_SALE_JOB,
        { saleId: s.id, title: s.title, description: s.description ?? undefined },
        {
          jobId: s.id,
          removeOnComplete: true,
          removeOnFail: 50,
          attempts: 3,
          backoff: { type: "exponential", delay: 1_000 },
        },
      ),
    ),
  );

  await embedQueue.close();

  console.log("\nSeeded sales:");
  for (const s of sales) {
    console.log(`  ${s.id}  ${s.title}`);
    console.log(`    http://localhost:3000/sales/${s.id}`);
  }
  console.log(`\nEnqueued ${sales.length} embed jobs → worker will populate embeddings.`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
