import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);
  app.enableShutdownHooks(); // lets BullMQ drain the active job on SIGTERM (NFR-5)
  // NFR-15: configuration comes from env (WORKER_PORT).
  const port = Number(process.env.WORKER_PORT ?? 3002);
  await app.listen(port);
  logger.log(`worker ready, health on :${port}/health`, "Bootstrap");

  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`received ${signal}, shutting down`, "Bootstrap");
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void bootstrap();
