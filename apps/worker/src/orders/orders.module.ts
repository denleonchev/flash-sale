import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ORDER_QUEUE } from "@flash-sale/shared";
import { OrderProcessor } from "./order.processor.js";
import { OrderFinalizer } from "./order.finalizer.js";
import { OrdersRepository } from "./orders.repository.js";
import { StockPublisher } from "../realtime/stock.publisher.js";

/**
 * Orders feature (consumer). `registerQueue` plus the processor/finalizer providers
 * make @nestjs/bullmq spin up the BullMQ Worker for the `orders` queue.
 * DbModule is global so PrismaService is available to OrdersRepository without re-importing.
 */
@Module({
  imports: [BullModule.registerQueue({ name: ORDER_QUEUE })],
  providers: [OrderProcessor, OrderFinalizer, OrdersRepository, StockPublisher],
})
export class OrdersModule {}
