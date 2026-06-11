import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

/**
 * worker entrypoint. A worker has no HTTP server — it is a background queue
 * consumer (docs/technical-design.md §3.3), so it boots a standalone Nest
 * application context, not an HTTP app. No queue/DB yet (S-E0.4 / S-E0.2).
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  // NFR-15: app service is self-hosted; configuration comes from env.
  Logger.log("worker ready", "Bootstrap");

  // Keep the process alive until the BullMQ consumer (S-E0.4) takes over — the
  // real Worker holds the loop open via its Redis connection. Until then a
  // no-op heartbeat keeps the standalone context from exiting.
  const heartbeat = setInterval(() => {}, 1 << 30);

  const shutdown = async (signal: string): Promise<void> => {
    Logger.log(`received ${signal}, shutting down`, "Bootstrap");
    clearInterval(heartbeat);
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void bootstrap();
