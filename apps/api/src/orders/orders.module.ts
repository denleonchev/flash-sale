import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ORDER_QUEUE } from "@flash-sale/shared";
import { SalesModule } from "../sales/sales.module.js";
import { StockModule } from "../stock/stock.module.js";
import { UsersModule } from "../users/users.module.js";
import { OrderProducer } from "./order.producer.js";
import { OrderResultPublisher } from "./order-result.publisher.js";
import { OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";
import { OrdersRepository } from "./orders.repository.js";

@Module({
  imports: [
    BullModule.registerQueue({ name: ORDER_QUEUE }),
    SalesModule,
    StockModule,
    UsersModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderProducer, OrderResultPublisher, OrdersRepository],
  exports: [OrdersService],
})
export class OrdersModule {}
