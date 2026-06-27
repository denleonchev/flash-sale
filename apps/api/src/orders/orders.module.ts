import { Module } from "@nestjs/common";
import { SalesModule } from "../sales/sales.module.js";
import { StockModule } from "../stock/stock.module.js";
import { UsersModule } from "../users/users.module.js";
import { OrderResultPublisher } from "./order-result.publisher.js";
import { OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";
import { OrdersRepository } from "./orders.repository.js";

@Module({
  imports: [SalesModule, StockModule, UsersModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderResultPublisher, OrdersRepository],
  exports: [OrdersService, OrdersRepository, OrderResultPublisher],
})
export class OrdersModule {}
