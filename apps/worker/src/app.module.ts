import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { DbModule } from "./db/db.module.js";
import { OrdersModule } from "./orders/orders.module.js";
import { QueueModule } from "./queue/queue.module.js";

/**
 * Root module. Health check (Terminus, S-E0.3) plus the queue consumer backbone
 * (S-E0.4a): QueueModule holds the shared Redis connection; OrdersModule runs the
 * BullMQ order processor. Background extras (email, embeddings) arrive later.
 */
@Module({
  imports: [HealthModule, DbModule, QueueModule, OrdersModule],
})
export class AppModule {}
