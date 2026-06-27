import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { ORDER_QUEUE, CAPTURE_ORDER_JOB, type CaptureOrderJobPayload } from "@flash-sale/shared";
import { CaptureOrderFinalizer } from "./order-capture.finalizer.js";

@Processor(ORDER_QUEUE, { concurrency: 1 })
export class CaptureOrderProcessor extends WorkerHost {
  private readonly logger = new Logger(CaptureOrderProcessor.name);

  constructor(private readonly finalizer: CaptureOrderFinalizer) {
    super();
  }

  async process(job: Job<CaptureOrderJobPayload>): Promise<void> {
    if (job.name !== CAPTURE_ORDER_JOB) return;
    this.logger.log(`processing capture job ${job.id} for order ${job.data.orderId}`);
    await this.finalizer.finalizeCapture(job.data);
  }
}
