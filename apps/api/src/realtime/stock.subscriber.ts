import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { REDIS_CHANNELS, type SaleStockUpdatedPayload } from "@flash-sale/shared";
import type { Redis } from "ioredis";
import { createRedisConnection } from "../redis/redis.connection.js";
import { SaleGateway } from "./sale.gateway.js";

/**
 * Dedicated subscribe-mode connection required — a pub/sub connection cannot issue
 * normal Redis commands, so it cannot share the BullMQ or Socket.IO adapter connection.
 *
 * Multi-instance: every api instance broadcasts, so N instances → N copies per client.
 * Harmless because the payload is an absolute count, not a delta.
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
