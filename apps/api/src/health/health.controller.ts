import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckResult, HealthCheckService } from "@nestjs/terminus";

/**
 * Liveness endpoint so the api can report healthy under docker-compose (S-E0.3).
 * Built on Terminus: an empty check list is a pure liveness probe (process up,
 * HTTP serving). DB/Redis readiness indicators are added with their connections
 * in S-E0.4.
 */
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }
}
