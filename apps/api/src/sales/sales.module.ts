import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module.js";
import { EmbedsModule } from "../embeds/embeds.module.js";
import { SalesController } from "./sales.controller.js";
import { SalesService } from "./sales.service.js";
import { SalesRepository } from "./sales.repository.js";
import { SalesAiService } from "./sales.ai.service.js";

@Module({
  imports: [AiModule, EmbedsModule],
  controllers: [SalesController],
  providers: [SalesService, SalesRepository, SalesAiService],
  exports: [SalesService, SalesRepository],
})
export class SalesModule {}
