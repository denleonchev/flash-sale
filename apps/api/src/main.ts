import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { RedisIoAdapter } from "./realtime/redis-io.adapter.js";

/**
 * api entrypoint. Boots the Nest HTTP app: health check, the order queue producer
 * (S-E0.4a) and the Socket.IO gateway with a Redis adapter for cross-instance
 * broadcasts (S-E0.4b). The DB is still wired later (S-E0.2).
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  // Browser may connect to the socket from the web origin; reflect it. (NFR-10)
  app.enableCors({ origin: true });
  // NFR-9: never trust the client — validate every DTO and strip unknown fields.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Redis-backed Socket.IO adapter → broadcasts fan out across api instances.
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);
  // NFR-15: app service is self-hosted; configuration comes from env (API_PORT).
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
