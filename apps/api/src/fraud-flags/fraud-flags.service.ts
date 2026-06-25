import { Injectable, NotFoundException } from "@nestjs/common";
import type { FraudFlag, FraudFlagStatus } from "@flash-sale/shared";
import { FraudFlagsRepository, type FraudFlagWithBuyer } from "./fraud-flags.repository.js";

function toDto(f: FraudFlagWithBuyer): FraudFlag {
  return {
    id: f.id,
    orderId: f.orderId,
    buyerId: f.buyerId,
    buyerEmail: f.buyerEmail,
    buyerName: f.buyerName,
    saleId: f.saleId,
    risk: f.risk as FraudFlag["risk"],
    reason: f.reason,
    pattern: f.pattern,
    status: f.status as FraudFlag["status"],
    createdAt: f.createdAt.toISOString(),
    reviewedAt: f.reviewedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class FraudFlagsService {
  constructor(private readonly repo: FraudFlagsRepository) {}

  async listFlags(status?: FraudFlagStatus): Promise<FraudFlag[]> {
    const flags = await this.repo.findAll(status);
    return flags.map(toDto);
  }

  async reviewFlag(id: string): Promise<FraudFlag> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException(`FraudFlag ${id} not found`);
    const updated = await this.repo.markReviewed(id);
    return toDto(updated);
  }
}
