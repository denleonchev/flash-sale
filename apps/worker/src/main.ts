import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

/**
 * worker entrypoint. The worker is a background queue consumer
 * (docs/technical-design.md §3.3): it runs the BullMQ order processor (S-E0.4a)
 * and also boots a minimal Nest HTTP app exposing only `GET /health`, so
 * docker-compose can report it healthy (S-E0.3). `enableShutdownHooks()` lets
 * BullMQ close cleanly on stop so the active job can finish (AC1); the DB is
 * still wired later (S-E0.2).
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  // NFR-15: app service is self-hosted; configuration comes from env (WORKER_PORT).
  const port = Number(process.env.WORKER_PORT ?? 3002);
  await app.listen(port);
  Logger.log(`worker ready, health on :${port}/health`, "Bootstrap");

  const shutdown = async (signal: string): Promise<void> => {
    Logger.log(`received ${signal}, shutting down`, "Bootstrap");
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void bootstrap();
