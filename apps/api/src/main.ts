import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

/**
 * api entrypoint. Boots the Nest HTTP app and nothing else yet — no queue, no DB.
 * Those are wired in later cards (S-E0.2 / S-E0.4). For now the app just needs to
 * start cleanly and serve the health check. (S-E0.1a)
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // NFR-15: app service is self-hosted; configuration comes from env (API_PORT).
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
