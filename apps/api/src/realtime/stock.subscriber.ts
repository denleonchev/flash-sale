import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import {
  REDIS_CHANNELS,
  type SaleStockUpdatedPayload,
} from "@flash-sale/shared";
import type { Redis } from "ioredis";
import { createRedisConnection } from "../redis/redis.connection.js";
import { SaleGateway } from "./sale.gateway.js";

/**
 * Subscribes to the Redis STOCK_CHANNEL and forwards each post-confirm stock count
 * to the sale room over Socket.IO (§4 step 10, §6). Symmetric counterpart of the
 * worker's StockPublisher.
 *
 * A subscribe-mode connection cannot issue normal commands, so we own a dedicated
 * connection here (separate from the BullMQ producer and the Socket.IO adapter).
 *
 * Multi-instance note: every api instance subscribes and broadcasts, so with N
 * instances a client receives N copies. The payload is the absolute remaining count,
 * so duplicates are idempotent and harmless; deduplicating to one instance is a
 * future optimisation, not needed at demo scale.
 */
@Injectable()
export class StockSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StockSubscriber.name);
  private readonly redis: Redis = createRedisConnection();

  constructor(private readonly gateway: SaleGateway) {}

  async onModuleInit(): Promise<void> {
    await this.redis.subscribe(REDIS_CHANNELS.STOCK);
    this.redis.on("message", (_channel, message) => {
      this.handleMessage(message);
    });
    this.logger.log(`subscribed to ${REDIS_CHANNELS.STOCK}`);
  }

  private handleMessage(message: string): void {
    let payload: SaleStockUpdatedPayload;
    try {
      payload = JSON.parse(message) as SaleStockUpdatedPayload;
    } catch {
      this.logger.warn(`dropping malformed stock message: ${message}`);
      return;
    }
    this.gateway.broadcastStock(payload);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
