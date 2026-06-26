import { Injectable } from "@nestjs/common";
import type { Sale } from "@flash-sale/db/client";
import { PrismaService } from "../db/prisma.service.js";

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
    const rows = await this.prisma.db.$queryRaw<RawSaleRow[]>`
      SELECT s.id, s.title, s.description, s.stock_total, s.price_cents, s.starts_at, s.ends_at, s.created_at,
             (COUNT(o.id) FILTER (WHERE o.status = 'confirmed'))::int AS confirmed_count
      FROM sales s
      LEFT JOIN orders o ON o.sale_id = s.id
      WHERE s.embedding IS NOT NULL
      GROUP BY s.id
      ORDER BY s.embedding <=> ${vectorStr}::vector
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
