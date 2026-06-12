import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
} from "@nestjs/terminus";

/**
 * Liveness endpoint so the worker can report healthy under docker-compose (S-E0.3).
 * The worker is a queue consumer (docs/technical-design.md §3.3); this tiny HTTP
 * surface exists only for the healthcheck. Built on Terminus — an empty check list
 * is a pure liveness probe; queue/DB indicators are added in S-E0.4.
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
