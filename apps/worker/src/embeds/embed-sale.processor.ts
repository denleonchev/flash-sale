import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { EMBED_SALE_QUEUE, type EmbedSaleJobPayload } from "@flash-sale/shared";
import { Job } from "bullmq";
import { EmbeddingService } from "./embedding.service.js";
import { SalesRepository } from "./sales.repository.js";

// concurrency: 1 keeps CPU load predictable on e2-micro. (NFR-14)
@Processor(EMBED_SALE_QUEUE, { concurrency: 1, maxStalledCount: 3 })
export class EmbedSaleProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbedSaleProcessor.name);

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly salesRepository: SalesRepository,
  ) {
    super();
  }

  async process(job: Job<EmbedSaleJobPayload>): Promise<void> {
    const { saleId, title, description } = job.data;
    const text = [title, description].filter(Boolean).join(" ");
    const vector = await this.embeddingService.embed(text);
    await this.salesRepository.updateEmbedding(saleId, vector);
    this.logger.log(`embedded sale ${saleId} (${vector.length} dims)`);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<EmbedSaleJobPayload>, err: Error): void {
    this.logger.error(`embed job ${job.id} failed: ${err.message}`);
  }
}
