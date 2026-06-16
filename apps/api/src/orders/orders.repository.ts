import { Injectable } from "@nestjs/common";
import { PrismaService } from "../db/prisma.service.js";

/** Raw DB access for orders. No business logic — returns Prisma rows as-is. */
@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the order matching the idempotency key, or null if not found. */
  findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<{ status: string } | null> {
    return this.prisma.db.order.findUnique({
      where: { idempotencyKey },
      select: { status: true },
    });
  }
}
