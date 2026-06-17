import { Module } from "@nestjs/common";
import { RealtimeController } from "./realtime.controller.js";
import { SaleGateway } from "./sale.gateway.js";
import { StockSubscriber } from "./stock.subscriber.js";
import { OrderResultSubscriber } from "./order-result.subscriber.js";
import { SalesModule } from "../sales/sales.module.js";
import { OrdersModule } from "../orders/orders.module.js";

/**
 * Realtime feature: the Socket.IO gateway, the worker→api stock relay (S-3.1,
 * FR-17), the per-buyer result relay (S-3.2, FR-18), and the dev broadcast hook
 * (S-E0.4b). The Redis-backed cross-instance adapter is wired at bootstrap in main.ts.
 *
 * SalesModule → gateway reads current stock snapshot on subscribe (FR-19).
 * OrdersModule → gateway reads last finalized order snapshot on connect (FR-19).
 * No cycle: OrdersModule does not import RealtimeModule.
 */
@Module({
  imports: [SalesModule, OrdersModule],
  controllers: [RealtimeController],
  providers: [SaleGateway, StockSubscriber, OrderResultSubscriber],
})
export class RealtimeModule {}
