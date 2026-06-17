import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { REDIS_CHANNELS, type OrderResult } from "@flash-sale/shared";
import type { Redis } from "ioredis";
import { createRedisConnection } from "../redis/redis.connection.js";

/**
 * Publishes per-buyer order results to Redis pub/sub after the order is committed
 * (§4 step 9, FR-18). The `api` subscribes to `ORDER_RESULT_CHANNEL` and relays
 * the result to the buyer's private socket room.
 *
 * Owns a dedicated connection — symmetric counterpart of `StockPublisher`.
 */
@Injectable()
export class OrderResultPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(OrderResultPublisher.name);
  private readonly redis: Redis = createRedisConnection();

  async publishOrderResult(result: OrderResult): Promise<void> {
    await this.redis.publish(REDIS_CHANNELS.ORDER_RESULT, JSON.stringify(result));
    this.logger.debug(
      `published result ${result.status} for buyer ${result.buyerId} sale ${result.saleId}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
