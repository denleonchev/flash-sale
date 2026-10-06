import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { ORDER_RECONCILIATION_QUEUE, RECONCILE_ORDERS_JOB } from "@flash-sale/shared";
import { OrderReconciliationService } from "./order-reconciliation.service.js";
import { runWithJobTrace } from "../tracing/with-job-trace.js";

@Processor(ORDER_RECONCILIATION_QUEUE, { concurrency: 1 })
export class OrderReconciliationProcessor extends WorkerHost {
  constructor(private readonly reconciliation: OrderReconciliationService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== RECONCILE_ORDERS_JOB) return;
    await runWithJobTrace(job.name, {}, () => this.reconciliation.reconcileStaleOrders());
  }
}
