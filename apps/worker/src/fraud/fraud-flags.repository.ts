import { Injectable } from "@nestjs/common";
import { RiskLevel } from "@flash-sale/shared";
import { PrismaService } from "../db/prisma.service.js";

interface BuyerActivity {
  attempts: number;
  confirmed: number;
  sold_out: number;
  failed: number;
  time_window_minutes: number;
  account_age_hours: number;
}

interface SimilarFlag {
  pattern: string;
  risk: RiskLevel;
  reason: string;
}

interface CreateFlagData {
  orderId: string;
  buyerId: string;
  saleId: string;
  risk: RiskLevel;
  reason: string;
  pattern: string;
  embedding?: number[];
}

@Injectable()
export class FraudFlagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getBuyerActivity(buyerId: string, windowMinutes: number): Promise<BuyerActivity> {
    const rows = await this.prisma.db.$queryRaw<BuyerActivity[]>`
      SELECT
        COUNT(*)::int                                                  AS attempts,
        COUNT(*) FILTER (WHERE status = 'confirmed')::int             AS confirmed,
        COUNT(*) FILTER (WHERE status = 'sold_out')::int              AS sold_out,
        COUNT(*) FILTER (WHERE status = 'failed')::int                AS failed,
        COALESCE(EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at)))/60, 0)::int
                                                                      AS time_window_minutes,
        COALESCE(
          EXTRACT(EPOCH FROM (NOW() - (
            SELECT MIN(created_at) FROM orders WHERE buyer_id = ${buyerId}
          )))/3600, 0
        )::int                                                        AS account_age_hours
      FROM orders
      WHERE buyer_id = ${buyerId}
        AND created_at >= NOW() - (${windowMinutes} * INTERVAL '1 minute')
    `;
    // $queryRaw always returns at least one row from COUNT aggregation
    return rows[0]!;
  }

  async findSimilarFlags(vector: number[], limit = 3): Promise<SimilarFlag[]> {
    // vector elements are finite floats produced by the model — safe to interpolate.
    const vectorStr = `[${vector.join(",")}]`;
    return this.prisma.db.$queryRawUnsafe<SimilarFlag[]>(
      `SELECT pattern, risk, reason
       FROM fraud_flags
       WHERE embedding IS NOT NULL
       ORDER BY embedding <-> '${vectorStr}'::vector
       LIMIT $1`,
      limit,
    );
  }

  async createFlag(data: CreateFlagData): Promise<void> {
    const flag = await this.prisma.db.fraudFlag.create({
      data: {
        orderId: data.orderId,
        buyerId: data.buyerId,
        saleId: data.saleId,
        risk: data.risk,
        reason: data.reason,
        pattern: data.pattern,
      },
      select: { id: true },
    });

    if (data.embedding) {
      const vectorStr = `[${data.embedding.join(",")}]`;
      await this.prisma.db.$executeRawUnsafe(
        `UPDATE fraud_flags SET embedding = '${vectorStr}'::vector WHERE id = $1`,
        flag.id,
      );
    }
  }
}
