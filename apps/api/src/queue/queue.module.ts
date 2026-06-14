import { BullModule } from "@nestjs/bullmq";
import { Global, Module } from "@nestjs/common";
import { createRedisConnection } from "../redis/redis.connection.js";

/**
 * Root BullMQ wiring (NFR-11). `forRoot` sets the shared Redis connection (from
 * REDIS_URL) used by every queue in this app. Marked `@Global` and imported once
 * in AppModule; feature modules then declare the queues they use with
 * `BullModule.registerQueue(...)` (see OrdersModule).
 */
@Global()
@Module({
  imports: [BullModule.forRoot({ connection: createRedisConnection() })],
  exports: [BullModule],
})
export class QueueModule {}
