import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { ORDER_JOB, ORDER_QUEUE, type OrderJobPayload } from "@flash-sale/shared";
import { Queue } from "bullmq";
import { buildOrderJob } from "./order.factory.js";

/**
 * Producer side of the purchase flow. The api does the fast work only — build the
 * job and enqueue it — then returns; the worker processes it independently
 * (§3.2). No shared memory between the two, only Redis (NFR-11).
 *
 * NOTE: this is the backbone for S-E0.4a. The atomic Redis stock reservation that
 * must precede the enqueue (§4 step 4) and request authentication are added in a
 * later card; today the endpoint enqueues directly to prove the path.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectQueue(ORDER_QUEUE) private readonly queue: Queue<OrderJobPayload>,
  ) {}

  /**
   * Enqueue one order job.
   *
   * Idempotency (FR-14, NFR-2): we set `jobId = idempotencyKey`. BullMQ ignores a
   * second `add` with an id that already exists, so a buyer double-clicking Buy
   * produces exactly one job. The consumer must also stay idempotent for the case
   * where a job is retried after a crash.
   */
  async enqueue(
    saleId: string,
    buyerId: string,
    idempotencyKey: string,
    quantity: number,
  ): Promise<{ jobId: string | undefined }> {
    const payload = buildOrderJob(saleId, buyerId, idempotencyKey, quantity);
    const job = await this.queue.add(ORDER_JOB, payload, {
      // Same id => duplicate requests collapse into a single job. (FR-14)
      jobId: idempotencyKey,
      removeOnComplete: true,
      // Keep the last 100 failures for debugging; older ones are trimmed.
      removeOnFail: 100,
    });
    this.logger.log(`enqueued order job ${job.id} for sale ${saleId}`);
    return { jobId: job.id };
  }
}
