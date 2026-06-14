import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { OrdersModule } from "./orders/orders.module.js";
import { QueueModule } from "./queue/queue.module.js";
import { RealtimeModule } from "./realtime/realtime.module.js";

/**
 * Root module. Health check (Terminus, S-E0.3), the queue backbone (S-E0.4a:
 * QueueModule + OrdersModule producer) and the realtime gateway (S-E0.4b:
 * RealtimeModule). Remaining feature modules (sales, auth) arrive in later cards.
 */
@Module({
  imports: [HealthModule, QueueModule, OrdersModule, RealtimeModule],
})
export class AppModule {}
