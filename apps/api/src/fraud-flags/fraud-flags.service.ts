import { Injectable, NotFoundException } from "@nestjs/common";
import type { FraudFlagDto, FraudFlagStatus } from "@flash-sale/shared";
import { FraudFlagsRepository } from "./fraud-flags.repository.js";
import type { FraudFlag } from "@flash-sale/db/client";

function toDto(f: FraudFlag): FraudFlagDto {
  return {
    id: f.id,
    orderId: f.orderId,
    buyerId: f.buyerId,
    saleId: f.saleId,
    risk: f.risk as FraudFlagDto["risk"],
    reason: f.reason,
    pattern: f.pattern,
    status: f.status as FraudFlagDto["status"],
    createdAt: f.createdAt.toISOString(),
    reviewedAt: f.reviewedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class FraudFlagsService {
  constructor(private readonly repo: FraudFlagsRepository) {}

  async listFlags(status?: FraudFlagStatus): Promise<FraudFlagDto[]> {
    const flags = await this.repo.findAll(status);
    return flags.map(toDto);
  }

  async reviewFlag(id: string): Promise<FraudFlagDto> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException(`FraudFlag ${id} not found`);
    const updated = await this.repo.markReviewed(id);
    return toDto(updated);
  }
}
