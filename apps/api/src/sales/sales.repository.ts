import { Injectable } from "@nestjs/common";
import type { Sale } from "@flash-sale/db/client";
import { PrismaService } from "../db/prisma.service.js";

/** Raw DB access for sales. No business logic — returns Prisma rows as-is. */
@Injectable()
export class SalesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns sale with confirmed order count in one query (§5: remaining = stockTotal − confirmed). */
  findById(id: string): Promise<(Sale & { _count: { orders: number } }) | null> {
    return this.prisma.db.sale.findUnique({
      where: { id },
      include: { _count: { select: { orders: { where: { status: "confirmed" } } } } },
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
