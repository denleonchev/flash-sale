import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { OrdersModule } from "./orders/orders.module.js";
import { QueueModule } from "./queue/queue.module.js";

/**
 * Root module. Health check (Terminus, S-E0.3) plus the queue backbone (S-E0.4a):
 * QueueModule holds the shared Redis connection; OrdersModule is the producer.
 * Remaining feature modules (sales, auth, realtime gateway) arrive in later cards.
 */
@Module({
  imports: [HealthModule, QueueModule, OrdersModule],
})
export class AppModule {}
