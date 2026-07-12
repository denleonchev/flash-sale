import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { getAppBaseUrl } from "./config/get-app-base-url.js";
import { RedisIoAdapter } from "./realtime/redis-io.adapter.js";

async function bootstrap(): Promise<void> {
  // rawBody: true is required for Stripe webhook signature verification. (FR-12)
  // bufferLogs: true holds bootstrap logs until app.useLogger attaches the pino logger below.
  const app = await NestFactory.create(AppModule, { rawBody: true, bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  // Only the web origin (APP_BASE_URL) may call the api from a browser — never reflect
  // an arbitrary Origin header.
  app.enableCors({ origin: getAppBaseUrl() });
  // NFR-9: never trust the client — validate every DTO and strip unknown fields.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);
  // NFR-15: app service is self-hosted; configuration comes from env (API_PORT).
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
