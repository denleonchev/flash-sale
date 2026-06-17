import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { REDIS_CHANNELS, type OrderResult } from "@flash-sale/shared";
import type { Redis } from "ioredis";
import { createRedisConnection } from "../redis/redis.connection.js";
import { SaleGateway } from "./sale.gateway.js";

/**
 * Subscribes to `ORDER_RESULT_CHANNEL` and forwards each result to the buyer's
 * private socket room via `SaleGateway.sendOrderResult`. Symmetric counterpart of
 * the worker's `OrderResultPublisher`. (FR-18)
 *
 * Owns a dedicated subscribe-mode connection — same reasoning as `StockSubscriber`.
 */
@Injectable()
export class OrderResultSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderResultSubscriber.name);
  private readonly redis: Redis = createRedisConnection();

  constructor(private readonly gateway: SaleGateway) {}

  async onModuleInit(): Promise<void> {
    await this.redis.subscribe(REDIS_CHANNELS.ORDER_RESULT);
    this.redis.on("message", (_channel, message) => {
      this.handleMessage(message);
    });
    this.logger.log(`subscribed to ${REDIS_CHANNELS.ORDER_RESULT}`);
  }

  private handleMessage(message: string): void {
    let result: OrderResult;
    try {
      result = JSON.parse(message) as OrderResult;
    } catch {
      this.logger.warn(`dropping malformed order result message: ${message}`);
      return;
    }
    this.gateway.sendOrderResult(result);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
