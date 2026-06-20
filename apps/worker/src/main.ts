import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks(); // lets BullMQ drain the active job on SIGTERM (NFR-5)
  // NFR-15: configuration comes from env (WORKER_PORT).
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
