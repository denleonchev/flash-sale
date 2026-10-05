import { Injectable } from "@nestjs/common";
import { FraudFlag } from "@flash-sale/db/client";
import { FRAUD_FLAG_STATUSES, type FraudFlagStatus } from "@flash-sale/shared";
import { PrismaService } from "../db/prisma.service.js";

const CITATIONS_INCLUDE = {
  citations: {
    orderBy: { position: "asc" },
    select: {
      position: true,
      distance: true,
      citedFlag: { select: { id: true, pattern: true, risk: true, reason: true, status: true } },
    },
  },
} as const;

interface CitationRow {
  position: number;
  distance: number;
  citedFlag: Pick<FraudFlag, "id" | "pattern" | "risk" | "reason" | "status">;
}

type FraudFlagWithCitations = FraudFlag & { citations: CitationRow[] };

export type FraudFlagWithBuyer = FraudFlagWithCitations & {
  buyerEmail: string | null;
  buyerName: string | null;
  saleTitle: string;
};

@Injectable()
export class FraudFlagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: FraudFlagStatus): Promise<FraudFlagWithBuyer[]> {
    const flags = await this.prisma.db.fraudFlag.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      include: { sale: { select: { title: true } }, ...CITATIONS_INCLUDE },
    });

    const buyerIds = [...new Set(flags.map((f) => f.buyerId))];
    const users = await this.prisma.db.user.findMany({
      where: { auth0Sub: { in: buyerIds } },
      select: { auth0Sub: true, email: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.auth0Sub, u]));

    return flags.map((f) => {
      const user = userMap.get(f.buyerId) ?? null;
      return {
        ...f,
        buyerEmail: user?.email ?? null,
        buyerName: user?.name ?? null,
        saleTitle: f.sale.title,
      };
    });
  }

  findById(id: string): Promise<FraudFlag | null> {
    return this.prisma.db.fraudFlag.findUnique({ where: { id } });
  }

  async updateStatus(id: string, status: FraudFlagStatus): Promise<FraudFlagWithBuyer> {
    const flag = await this.prisma.db.fraudFlag.update({
      where: { id },
      data: { status, reviewedAt: status === FRAUD_FLAG_STATUSES.OPEN ? null : new Date() },
      include: CITATIONS_INCLUDE,
    });
    return this.enrichWithBuyer(flag);
  }

  private async enrichWithBuyer(flag: FraudFlagWithCitations): Promise<FraudFlagWithBuyer> {
    const [user, sale] = await Promise.all([
      this.prisma.db.user.findUnique({
        where: { auth0Sub: flag.buyerId },
        select: { email: true, name: true },
      }),
      this.prisma.db.sale.findUniqueOrThrow({
        where: { id: flag.saleId },
        select: { title: true },
      }),
    ]);
    return {
      ...flag,
      buyerEmail: user?.email ?? null,
      buyerName: user?.name ?? null,
      saleTitle: sale.title,
    };
  }
}
