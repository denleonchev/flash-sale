import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { REDIS_CHANNELS, type OrderResult } from "@flash-sale/shared";
import type { Redis } from "ioredis";
import { createRedisConnection } from "../redis/redis.connection.js";

/**
 * Publishes per-buyer order results from the api to Redis pub/sub. Used on the
 * hot path to deliver the `in_progress` notification immediately after the api
 * creates the order row and enqueues the job (§4 step 5). The existing
 * `OrderResultSubscriber` picks this up and routes it to the buyer's private
 * socket room — no direct dependency on SaleGateway from the service layer.
 *
 * Symmetric counterpart of the worker's `OrderResultPublisher`. (FR-18)
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
