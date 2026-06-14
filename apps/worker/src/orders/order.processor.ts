import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import {
  ORDER_QUEUE,
  type OrderJobPayload,
  type OrderResult,
} from "@flash-sale/shared";
import { Job } from "bullmq";
import { handleOrderJob } from "./order.consumer.js";

/**
 * BullMQ consumer for the `orders` queue (§3.3).
 *
 * Concurrency = 1 (FR-10, .claude/rules/concurrency.md): the worker processes at
 * most one order job at a time, so stock confirmation is strictly serialised —
 * two buyers hitting the last unit are handled one after the other, never in
 * parallel. Do not raise this without revisiting the oversell-prevention design.
 *
 * The actual work is delegated to `handleOrderJob` (a placeholder today: the real
 * payment step → Postgres transaction → pub/sub result lands in a later card).
 * The handler must be idempotent: after a crash BullMQ may re-deliver the job,
 * and a retry must not double its effect (NFR-2).
 */
@Processor(ORDER_QUEUE, { concurrency: 1 })
export class OrderProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderProcessor.name);

  async process(job: Job<OrderJobPayload>): Promise<OrderResult> {
    this.logger.log(
      `picked up order job ${job.id} (key ${job.data.idempotencyKey})`,
    );
    const result = handleOrderJob(job.data);
    this.logger.log(`processed order job ${job.id} -> ${result.status}`);
    return result;
  }
}
