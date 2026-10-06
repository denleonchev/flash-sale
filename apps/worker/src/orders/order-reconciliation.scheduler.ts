import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, type OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { ORDER_RECONCILIATION_QUEUE, RECONCILE_ORDERS_JOB } from "@flash-sale/shared";

const RECONCILE_EVERY_MS = 60_000;

@Injectable()
export class OrderReconciliationScheduler implements OnModuleInit {
  constructor(@InjectQueue(ORDER_RECONCILIATION_QUEUE) private readonly queue: Queue) {}

  // Upsert is keyed by the scheduler id, so restarts and extra worker instances keep a
  // single schedule instead of stacking one per boot.
  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      RECONCILE_ORDERS_JOB,
      { every: RECONCILE_EVERY_MS },
      // No attempts: a failed run is simply superseded by the next one a minute later.
      { name: RECONCILE_ORDERS_JOB, opts: { removeOnComplete: true, removeOnFail: 20 } },
    );
  }
}
