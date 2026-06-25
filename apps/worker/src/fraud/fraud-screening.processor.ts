import { Logger } from "@nestjs/common";
import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { FRAUD_SCREENING_QUEUE, type FraudScreeningJobPayload } from "@flash-sale/shared";
import { FraudScreeningService } from "./fraud-screening.service.js";

// concurrency: 5 — fraud jobs are off the critical path; parallelism is safe here.
@Processor(FRAUD_SCREENING_QUEUE, { concurrency: 5 })
export class FraudScreeningProcessor extends WorkerHost {
  private readonly logger = new Logger(FraudScreeningProcessor.name);

  constructor(private readonly service: FraudScreeningService) {
    super();
  }

  async process(job: Job<FraudScreeningJobPayload>): Promise<void> {
    await this.service.screen(job.data);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job, err: Error): void {
    this.logger.error(`fraud-screening job ${job.id} failed: ${err.message}`);
  }
}
