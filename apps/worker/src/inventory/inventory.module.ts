import { Inject, Module, type OnModuleDestroy } from "@nestjs/common";
import type { Redis } from "ioredis";
import { InventoryService } from "@flash-sale/inventory";
import { createRedisConnection } from "../redis/redis.connection.js";

const INVENTORY_REDIS = "INVENTORY_REDIS";

/**
 * The worker only releases stock, so it passes no stock counts loader.
 * Owns a dedicated connection so the release never contends with BullMQ's blocking connection.
 */
@Module({
  providers: [
    { provide: INVENTORY_REDIS, useFactory: createRedisConnection },
    {
      provide: InventoryService,
      inject: [INVENTORY_REDIS],
      useFactory: (redis: Redis) => new InventoryService(redis),
    },
  ],
  exports: [InventoryService],
})
export class InventoryModule implements OnModuleDestroy {
  constructor(@Inject(INVENTORY_REDIS) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
