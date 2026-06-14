import { Module } from "@nestjs/common";
import { RealtimeController } from "./realtime.controller.js";
import { SaleGateway } from "./sale.gateway.js";

/**
 * Realtime feature: the Socket.IO gateway plus the dev broadcast hook (S-E0.4b).
 * The Redis-backed cross-instance adapter is wired at bootstrap in main.ts.
 */
@Module({
  controllers: [RealtimeController],
  providers: [SaleGateway],
})
export class RealtimeModule {}
