import { Module } from "@nestjs/common";
import { DbModule } from "./db/db.module.js";
import { HealthModule } from "./health/health.module.js";
import { OrdersModule } from "./orders/orders.module.js";
import { QueueModule } from "./queue/queue.module.js";
import { RealtimeModule } from "./realtime/realtime.module.js";
import { SalesModule } from "./sales/sales.module.js";
import { FraudFlagsModule } from "./fraud-flags/fraud-flags.module.js";
import { StripeWebhookModule } from "./stripe-webhook/stripe-webhook.module.js";

/**
 * Root module. Health check (Terminus, S-E0.3), queue backbone (S-E0.4a/b),
 * DB (S-1.1b: DbModule global), and Sales feature (GET /sales/:id, FR-5).
 */
@Module({
  imports: [
    DbModule,
    HealthModule,
    QueueModule,
    OrdersModule,
    RealtimeModule,
    SalesModule,
    FraudFlagsModule,
    StripeWebhookModule,
  ],
})
export class AppModule {}
