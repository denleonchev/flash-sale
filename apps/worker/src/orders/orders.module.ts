import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ORDER_QUEUE, ORDER_RECONCILIATION_QUEUE } from "@flash-sale/shared";
import { CaptureOrderProcessor } from "./order-capture.processor.js";
import { CaptureOrderFinalizer } from "./order-capture.finalizer.js";
import { OrderReconciliationProcessor } from "./order-reconciliation.processor.js";
import { OrderReconciliationScheduler } from "./order-reconciliation.scheduler.js";
import { OrderReconciliationService } from "./order-reconciliation.service.js";
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
  imports: [
    BullModule.registerQueue({ name: ORDER_QUEUE }, { name: ORDER_RECONCILIATION_QUEUE }),
    PaymentModule,
    FraudModule,
  ],
  providers: [
    CaptureOrderProcessor,
    CaptureOrderFinalizer,
    OrderReconciliationProcessor,
    OrderReconciliationScheduler,
    OrderReconciliationService,
    OrdersRepository,
    StockReleaseService,
    StockPublisher,
    OrderResultPublisher,
  ],
})
export class OrdersModule {}
