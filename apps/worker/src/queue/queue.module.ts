import { BullModule } from "@nestjs/bullmq";
import { Global, Module } from "@nestjs/common";
import { createRedisConnection } from "../redis/redis.connection.js";

/**
 * Root BullMQ wiring for the worker (NFR-11). `forRoot` sets the shared Redis
 * connection (from REDIS_URL). Marked `@Global` and imported once in AppModule;
 * the orders feature declares the queue it consumes with `registerQueue`.
 */
@Global()
@Module({
  imports: [BullModule.forRoot({ connection: createRedisConnection() })],
  exports: [BullModule],
})
export class QueueModule {}
