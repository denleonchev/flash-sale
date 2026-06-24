import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { EMBED_SALE_QUEUE } from "@flash-sale/shared";
import { EmbedSaleProcessor } from "./embed-sale.processor.js";
import { EmbeddingService } from "./embedding.service.js";
import { SalesRepository } from "./sales.repository.js";

@Module({
  imports: [BullModule.registerQueue({ name: EMBED_SALE_QUEUE })],
  providers: [EmbedSaleProcessor, EmbeddingService, SalesRepository],
})
export class EmbedsModule {}
