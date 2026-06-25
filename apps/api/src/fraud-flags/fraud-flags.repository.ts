import { Injectable } from "@nestjs/common";
import { FraudFlag } from "@flash-sale/db/client";
import type { FraudFlagStatus } from "@flash-sale/shared";
import { PrismaService } from "../db/prisma.service.js";

@Injectable()
export class FraudFlagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(status?: FraudFlagStatus): Promise<FraudFlag[]> {
    return this.prisma.db.fraudFlag.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: string): Promise<FraudFlag | null> {
    return this.prisma.db.fraudFlag.findUnique({ where: { id } });
  }

  markReviewed(id: string): Promise<FraudFlag> {
    return this.prisma.db.fraudFlag.update({
      where: { id },
      data: { status: "reviewed", reviewedAt: new Date() },
    });
  }
}
