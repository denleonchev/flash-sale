import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { ORDER_QUEUE, type OrderJobPayload } from "@flash-sale/shared";
import { Job } from "bullmq";
import { OrderFinalizer } from "./order.finalizer.js";

/**
 * Concurrency = 1 (FR-10, .claude/rules/concurrency.md): the worker processes at
 * most one order job at a time, so stock confirmation is strictly serialised —
 * two buyers hitting the last unit are handled one after the other, never in
 * parallel. Do not raise this without revisiting the oversell-prevention design.
 *
 * The handler must be idempotent: after a crash BullMQ may re-deliver the job,
 * and a retry must not double its effect (NFR-2). Idempotency is enforced in
 * OrderFinalizer via guarded UPDATE (WHERE status = in_progress) + count===0 read-back.
 */
@Processor(ORDER_QUEUE, { concurrency: 1 })
export class OrderProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderProcessor.name);

  constructor(private readonly finalizer: OrderFinalizer) {
    super();
  }

  async process(job: Job<OrderJobPayload>): Promise<void> {
    this.logger.log(
      `picked up order job ${job.id} (key ${job.data.idempotencyKey})`,
    );
    await this.finalizer.finalizeOrder(job.data);
  }
}
