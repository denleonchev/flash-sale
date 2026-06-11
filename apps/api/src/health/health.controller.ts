import { Controller, Get } from "@nestjs/common";

/**
 * Liveness endpoint so the api can report healthy under docker-compose (S-E0.3).
 * Plain controller — no DB/queue dependency, just proves the process is up.
 */
@Controller()
export class HealthController {
  @Get("health")
  health(): { status: string } {
    return { status: "ok" };
  }
}
