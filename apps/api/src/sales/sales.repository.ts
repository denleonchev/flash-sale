import { Injectable } from "@nestjs/common";
import type { Sale } from "@flash-sale/db/client";
import { PrismaService } from "../db/prisma.service.js";

// FR-26: cosine distance threshold for semantic search. all-MiniLM-L6-v2 synonyms
// (e.g. "old" ↔ "vintage") typically land at 0.6–0.75; 0.8 keeps them while
// cutting genuinely unrelated results.
const SEARCH_DISTANCE_THRESHOLD = 0.8;

interface RawSaleRow {
  id: string;
  title: string;
  description: string | null;
  stock_total: number;
  price_cents: number;
  starts_at: Date;
  ends_at: Date;
  created_at: Date;
  confirmed_count: number;
}

@Injectable()
export class SalesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<(Sale & { _count: { orders: number } }) | null> {
    return this.prisma.db.sale.findUnique({
      where: { id },
      include: { _count: { select: { orders: { where: { status: "confirmed" } } } } },
    });
  }

  // Includes confirmed count to avoid N+1 on listing.
  findAll(): Promise<Array<Sale & { _count: { orders: number } }>> {
    return this.prisma.db.sale.findMany({
      orderBy: { startsAt: "asc" },
      include: {
        _count: { select: { orders: { where: { status: "confirmed" } } } },
      },
    });
  }

  create(data: {
    title: string;
    description?: string;
    stockTotal: number;
    priceCents: number;
    startsAt: Date;
    endsAt: Date;
  }): Promise<Sale> {
    return this.prisma.db.sale.create({ data });
  }

  endNow(id: string): Promise<Sale> {
    return this.prisma.db.sale.update({ where: { id }, data: { endsAt: new Date() } });
  }

  // FR-26: cosine distance (<=>); returns only sales with an embedding; sorted by relevance.
  async searchByEmbedding(
    vector: number[],
    limit = 10,
  ): Promise<Array<Sale & { _count: { orders: number } }>> {
    const vectorStr = `[${vector.join(",")}]`;
    // Subquery computes distance once so the vector literal is parameterised a single time.
    // Threshold 0.6 ≈ cosine similarity > 0.4 — filters genuinely unrelated sales. (FR-26)
    const rows = await this.prisma.db.$queryRaw<RawSaleRow[]>`
      SELECT id, title, description, stock_total, price_cents, starts_at, ends_at, created_at, confirmed_count
      FROM (
        SELECT s.id, s.title, s.description, s.stock_total, s.price_cents, s.starts_at, s.ends_at, s.created_at,
               (COUNT(o.id) FILTER (WHERE o.status = 'confirmed'))::int AS confirmed_count,
               s.embedding <=> ${vectorStr}::vector AS distance
        FROM sales s
        LEFT JOIN orders o ON o.sale_id = s.id
        WHERE s.embedding IS NOT NULL
        GROUP BY s.id
      ) ranked
      WHERE distance < ${SEARCH_DISTANCE_THRESHOLD}
      ORDER BY distance
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      stockTotal: r.stock_total,
      priceCents: r.price_cents,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      createdAt: r.created_at,
      embedding: null,
      _count: { orders: r.confirmed_count },
    }));
  }
}
