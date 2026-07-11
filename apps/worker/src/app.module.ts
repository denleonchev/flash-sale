import { Module } from "@nestjs/common";
import { AppLoggerModule } from "./logger/logger.module.js";
import { HealthModule } from "./health/health.module.js";
import { DbModule } from "./db/db.module.js";
import { OrdersModule } from "./orders/orders.module.js";
import { QueueModule } from "./queue/queue.module.js";
import { EmbedsModule } from "./embeds/embeds.module.js";
import { FraudModule } from "./fraud/fraud.module.js";

@Module({
  imports: [
    AppLoggerModule,
    HealthModule,
    DbModule,
    QueueModule,
    OrdersModule,
    EmbedsModule,
    FraudModule,
  ],
})
export class AppModule {}
