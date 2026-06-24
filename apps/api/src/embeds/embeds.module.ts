import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { EMBED_SALE_QUEUE } from "@flash-sale/shared";
import { EmbedSaleProducer } from "./embed-sale.producer.js";
import { EmbeddingService } from "./embedding.service.js";

@Module({
  imports: [BullModule.registerQueue({ name: EMBED_SALE_QUEUE })],
  providers: [EmbedSaleProducer, EmbeddingService],
  exports: [EmbedSaleProducer, EmbeddingService],
})
export class EmbedsModule {}
