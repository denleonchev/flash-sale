import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import type { Redis } from "ioredis";
import { createRedisConnection } from "../redis/redis.connection.js";

/**
 * Restores a reserved Redis stock unit when an order payment fails (FR-16).
 * Key pattern mirrors `api/src/stock/stock.repository.ts`: `stock:{saleId}`.
 * Owns a dedicated connection so INCRBY never contends with BullMQ's blocking connection.
 */
@Injectable()
export class StockReleaseService implements OnModuleDestroy {
  private readonly redis: Redis = createRedisConnection();

  async releaseStock(saleId: string, qty: number): Promise<void> {
    await this.redis.incrby(`stock:${saleId}`, qty);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
