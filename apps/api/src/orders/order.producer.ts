import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { ORDER_JOB, ORDER_QUEUE, type OrderJobPayload } from "@flash-sale/shared";
import { Queue } from "bullmq";

/**
 * Idempotency (FR-14, NFR-2): jobId = idempotencyKey — BullMQ ignores a
 * second add with an id that already exists in the queue.
 */
@Injectable()
export class OrderProducer {
  private readonly logger = new Logger(OrderProducer.name);

  constructor(
    @InjectQueue(ORDER_QUEUE) private readonly queue: Queue<OrderJobPayload>,
  ) {}

  async isEnqueued(idempotencyKey: string): Promise<boolean> {
    return (await this.queue.getJob(idempotencyKey)) !== undefined;
  }

  async enqueueOrderJob(
    saleId: string,
    buyerId: string,
    idempotencyKey: string,
    quantity: number,
  ): Promise<void> {
    const payload: OrderJobPayload = { saleId, buyerId, idempotencyKey, quantity };
    const job = await this.queue.add(ORDER_JOB, payload, {
      jobId: idempotencyKey,
      removeOnComplete: true,
      removeOnFail: 100,
    });
    this.logger.log(`enqueued order job ${job.id} for sale ${saleId}`);
  }
}
