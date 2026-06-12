import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";

/**
 * Root module. Skeleton for S-E0.1a — only the health check is wired up (via
 * Terminus, S-E0.3). Feature modules (orders, sales, auth, realtime gateway)
 * arrive in later cards.
 */
@Module({
  imports: [HealthModule],
})
export class AppModule {}
