import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import type { Redis } from "ioredis";
import { RELEASE_STOCK_SCRIPT, getStockKey } from "@flash-sale/shared";
import { createRedisConnection } from "../redis/redis.connection.js";

/**
 * Restores a reserved Redis stock unit when an order payment fails (FR-16).
 * Owns a dedicated connection so the release never contends with BullMQ's blocking connection.
 */
@Injectable()
export class StockReleaseService implements OnModuleDestroy {
  private readonly redis: Redis = createRedisConnection();

  async releaseStock(saleId: string, qty: number): Promise<void> {
    await this.redis.eval(RELEASE_STOCK_SCRIPT, 1, getStockKey(saleId), qty);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
