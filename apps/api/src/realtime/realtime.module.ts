import { Module } from "@nestjs/common";
import { SaleGateway } from "./sale.gateway.js";
import { StockSubscriber } from "./stock.subscriber.js";
import { OrderResultSubscriber } from "./order-result.subscriber.js";
import { SalesModule } from "../sales/sales.module.js";
import { OrdersModule } from "../orders/orders.module.js";

// SalesModule → stock snapshot on subscribe (FR-19).
// OrdersModule → last finalized order snapshot on reconnect (FR-19).
// No cycle: OrdersModule does not import RealtimeModule.
@Module({
  imports: [SalesModule, OrdersModule],
  providers: [SaleGateway, StockSubscriber, OrderResultSubscriber],
})
export class RealtimeModule {}
