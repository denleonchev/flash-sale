import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
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
 * Crash survival (NFR-5): BullMQ holds a lock on the active job in Redis. If the
 * worker dies, the lock expires after lockDuration (default 30 s); BullMQ marks the
 * job stalled and re-queues it up to maxStalledCount times. maxStalledCount: 3
 * matches attempts: 3 in the producer so both retry paths get the same number of
 * chances. Re-delivery is safe — OrderFinalizer enforces idempotency via guarded
 * UPDATE (WHERE status = in_progress).
 */
@Processor(ORDER_QUEUE, { concurrency: 1, maxStalledCount: 3 })
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

  @OnWorkerEvent("failed")
  onFailed(job: Job<OrderJobPayload>, err: Error): void {
    this.logger.error(
      `job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts ?? 1}): ${err.message}`,
    );
  }

  @OnWorkerEvent("stalled")
  onStalled(jobId: string): void {
    this.logger.warn(`job ${jobId} stalled — BullMQ will re-queue`);
  }
}
