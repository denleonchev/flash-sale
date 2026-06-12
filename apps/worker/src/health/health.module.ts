import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./health.controller.js";

/**
 * Wires Terminus and the liveness controller (S-E0.3). Kept as its own module so
 * S-E0.4 can add queue/DB health indicators here without touching AppModule.
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
