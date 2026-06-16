import { Module } from "@nestjs/common";
import { RealtimeController } from "./realtime.controller.js";
import { SaleGateway } from "./sale.gateway.js";
import { StockSubscriber } from "./stock.subscriber.js";
import { SalesModule } from "../sales/sales.module.js";

/**
 * Realtime feature: the Socket.IO gateway, the worker→api stock relay (S-3.1,
 * FR-17), plus the dev broadcast hook (S-E0.4b). The Redis-backed cross-instance
 * adapter is wired at bootstrap in main.ts. SalesModule is imported so the gateway
 * can read the current stock snapshot it pushes on subscribe (FR-19).
 */
@Module({
  imports: [SalesModule],
  controllers: [RealtimeController],
  providers: [SaleGateway, StockSubscriber],
})
export class RealtimeModule {}
