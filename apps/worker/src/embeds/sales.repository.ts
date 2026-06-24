import { Injectable } from "@nestjs/common";
import { PrismaService } from "../db/prisma.service.js";

@Injectable()
export class SalesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async updateEmbedding(saleId: string, vector: number[]): Promise<void> {
    // vector elements are finite floats produced by the model — safe to interpolate.
    const vectorStr = `[${vector.join(",")}]`;
    await this.prisma.db.$executeRawUnsafe(
      `UPDATE sales SET embedding = '${vectorStr}'::vector WHERE id = $1`,
      saleId,
    );
  }
}
