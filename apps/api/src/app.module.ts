import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller.js";

/**
 * Root module. Skeleton for S-E0.1a — only the health check is wired up.
 * Feature modules (orders, sales, auth, realtime gateway) arrive in later cards.
 */
@Module({
  controllers: [HealthController],
})
export class AppModule {}
