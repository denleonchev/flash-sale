import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { EMBED_SALE_JOB, EMBED_SALE_QUEUE, type EmbedSaleJobPayload } from "@flash-sale/shared";
import { Queue } from "bullmq";

@Injectable()
export class EmbedSaleProducer {
  private readonly logger = new Logger(EmbedSaleProducer.name);

  constructor(
    @InjectQueue(EMBED_SALE_QUEUE) private readonly queue: Queue<EmbedSaleJobPayload>,
  ) {}

  async enqueueEmbedSale(saleId: string, title: string, description?: string): Promise<void> {
    const payload: EmbedSaleJobPayload = { saleId, title, description };
    // jobId: saleId collapses duplicates — BullMQ ignores a second add with the same jobId. (NFR-14)
    await this.queue.add(EMBED_SALE_JOB, payload, {
      jobId: saleId,
      removeOnComplete: true,
      removeOnFail: 50,
      attempts: 3,
      backoff: { type: "exponential", delay: 1_000 },
    });
    this.logger.log(`enqueued embed job for sale ${saleId}`);
  }
}
