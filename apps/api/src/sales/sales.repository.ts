import { Injectable } from "@nestjs/common";
import type { Sale } from "@flash-sale/db/client";
import { PrismaService } from "../db/prisma.service.js";

/** Raw DB access for sales. No business logic — returns Prisma rows as-is. */
@Injectable()
export class SalesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Sale | null> {
    return this.prisma.db.sale.findUnique({ where: { id } });
  }

  /** Count orders that have been confirmed for a sale (§5: remaining = stockTotal − confirmed). */
  countConfirmedOrders(saleId: string): Promise<number> {
    return this.prisma.db.order.count({
      where: { saleId, status: "confirmed" },
    });
  }

  /** All sales with confirmed order counts in one query (avoids N+1). */
  findAll(): Promise<Array<Sale & { _count: { orders: number } }>> {
    return this.prisma.db.sale.findMany({
      orderBy: { startsAt: "asc" },
      include: {
        _count: { select: { orders: { where: { status: "confirmed" } } } },
      },
    });
  }
}
