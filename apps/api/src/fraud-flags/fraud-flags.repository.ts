import { Injectable } from "@nestjs/common";
import { FraudFlag } from "@flash-sale/db/client";
import type { FraudFlagStatus } from "@flash-sale/shared";
import { PrismaService } from "../db/prisma.service.js";

export type FraudFlagWithBuyer = FraudFlag & {
  buyerEmail: string | null;
  buyerName: string | null;
};

@Injectable()
export class FraudFlagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: FraudFlagStatus): Promise<FraudFlagWithBuyer[]> {
    const flags = await this.prisma.db.fraudFlag.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
    });

    const buyerIds = [...new Set(flags.map((f) => f.buyerId))];
    const users = await this.prisma.db.user.findMany({
      where: { auth0Sub: { in: buyerIds } },
      select: { auth0Sub: true, email: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.auth0Sub, u]));

    return flags.map((f) => {
      const user = userMap.get(f.buyerId) ?? null;
      return { ...f, buyerEmail: user?.email ?? null, buyerName: user?.name ?? null };
    });
  }

  findById(id: string): Promise<FraudFlag | null> {
    return this.prisma.db.fraudFlag.findUnique({ where: { id } });
  }

  async markReviewed(id: string): Promise<FraudFlagWithBuyer> {
    const flag = await this.prisma.db.fraudFlag.update({
      where: { id },
      data: { status: "reviewed", reviewedAt: new Date() },
    });
    return this.enrichWithBuyer(flag);
  }

  private async enrichWithBuyer(flag: FraudFlag): Promise<FraudFlagWithBuyer> {
    const user = await this.prisma.db.user.findUnique({
      where: { auth0Sub: flag.buyerId },
      select: { email: true, name: true },
    });
    return { ...flag, buyerEmail: user?.email ?? null, buyerName: user?.name ?? null };
  }
}
