import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ORDER_RECONCILIATION_QUEUE } from "@flash-sale/shared";
import { SalesModule } from "../sales/sales.module.js";
import { InventoryModule } from "../inventory/inventory.module.js";
import { UsersModule } from "../users/users.module.js";
import { OrderResultPublisher } from "./order-result.publisher.js";
import { OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";
import { OrdersRepository } from "./orders.repository.js";

@Module({
  imports: [
    SalesModule,
    InventoryModule,
    UsersModule,
    BullModule.registerQueue({ name: ORDER_RECONCILIATION_QUEUE }),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderResultPublisher, OrdersRepository],
  exports: [OrdersService, OrdersRepository, OrderResultPublisher],
})
export class OrdersModule {}
