import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import {
  ORDER_RECONCILIATION_QUEUE,
  RECONCILE_ORDER_JOB,
  RECONCILE_ORDERS_JOB,
  type ReconcileOrderJobPayload,
} from "@flash-sale/shared";
import { OrderReconciliationService } from "./order-reconciliation.service.js";
import { runWithJobTrace } from "../tracing/with-job-trace.js";

@Processor(ORDER_RECONCILIATION_QUEUE, { concurrency: 1 })
export class OrderReconciliationProcessor extends WorkerHost {
  constructor(private readonly reconciliation: OrderReconciliationService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === RECONCILE_ORDERS_JOB) {
      await runWithJobTrace(job.name, {}, () => this.reconciliation.reconcileStaleOrders());
      return;
    }
    if (job.name === RECONCILE_ORDER_JOB) {
      const data = job.data as ReconcileOrderJobPayload;
      await runWithJobTrace(job.name, data, () =>
        this.reconciliation.reconcileOrderById(data.orderId),
      );
    }
  }
}
