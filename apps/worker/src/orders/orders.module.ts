import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ORDER_QUEUE } from "@flash-sale/shared";
import { OrderProcessor } from "./order.processor.js";

/**
 * Orders feature (consumer). `registerQueue` plus the `OrderProcessor` provider
 * are what make @nestjs/bullmq spin up the BullMQ Worker for the `orders` queue;
 * the connection comes from the global QueueModule's forRoot.
 */
@Module({
  imports: [BullModule.registerQueue({ name: ORDER_QUEUE })],
  providers: [OrderProcessor],
})
export class OrdersModule {}
