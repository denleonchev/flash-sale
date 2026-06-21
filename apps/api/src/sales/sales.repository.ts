import { Injectable } from "@nestjs/common";
import type { Sale } from "@flash-sale/db/client";
import { PrismaService } from "../db/prisma.service.js";

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

  create(data: { title: string; stockTotal: number; startsAt: Date; endsAt: Date }): Promise<Sale> {
    return this.prisma.db.sale.create({ data });
  }
}
