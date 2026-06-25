import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ORDER_QUEUE } from "@flash-sale/shared";
import { OrderProcessor } from "./order.processor.js";
import { OrderFinalizer } from "./order.finalizer.js";
import { OrdersRepository } from "./orders.repository.js";
import { StockReleaseService } from "./stock-release.service.js";
import { StockPublisher } from "../realtime/stock.publisher.js";
import { OrderResultPublisher } from "../realtime/order-result.publisher.js";
import { PaymentModule } from "../payment/payment.module.js";
import { FraudModule } from "../fraud/fraud.module.js";

/**
 * Orders feature (consumer). `registerQueue` plus the processor/finalizer providers
 * make @nestjs/bullmq spin up the BullMQ Worker for the `orders` queue.
 * DbModule is global so PrismaService is available to OrdersRepository without re-importing.
 */
@Module({
  imports: [BullModule.registerQueue({ name: ORDER_QUEUE }), PaymentModule, FraudModule],
  providers: [OrderProcessor, OrderFinalizer, OrdersRepository, StockReleaseService, StockPublisher, OrderResultPublisher],
})
export class OrdersModule {}
