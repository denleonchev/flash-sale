import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";

/**
 * Root module. Skeleton for S-E0.1b — only the health check is wired up (via
 * Terminus, S-E0.3) so the worker can report healthy under docker-compose.
 * Feature modules (order consumer, email, embeddings) arrive in later cards
 * (S-E0.4 and beyond).
 */
@Module({
  imports: [HealthModule],
})
export class AppModule {}
