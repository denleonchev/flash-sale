import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ORDER_QUEUE } from "@flash-sale/shared";
import { SalesModule } from "../sales/sales.module.js";
import { StockModule } from "../stock/stock.module.js";
import { OrderProducer } from "./order.producer.js";
import { OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";

@Module({
  imports: [
    BullModule.registerQueue({ name: ORDER_QUEUE }),
    SalesModule,
    StockModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderProducer],
})
export class OrdersModule {}
