import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { REDIS_CHANNELS, type SaleStockUpdatedPayload } from "@flash-sale/shared";
import type { Redis } from "ioredis";
import { createRedisConnection } from "../redis/redis.connection.js";

/**
 * Publishes post-confirm stock counts to Redis pub/sub (§4 step 9, §6). The `api`
 * subscribes to `STOCK_CHANNEL` and relays the count to everyone watching the sale
 * over Socket.IO — the worker never touches sockets. (FR-17)
 *
 * Owns a dedicated connection so a `PUBLISH` never contends with BullMQ's blocking
 * connection. `PUBLISH` is a normal command, so the BullMQ `maxRetriesPerRequest:
 * null` setting is harmless here.
 */
@Injectable()
export class StockPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(StockPublisher.name);
  private readonly redis: Redis = createRedisConnection();

  async publishStock(payload: SaleStockUpdatedPayload): Promise<void> {
    await this.redis.publish(REDIS_CHANNELS.STOCK, JSON.stringify(payload));
    this.logger.debug(`published stock ${payload.remainingStock} for sale ${payload.saleId}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
