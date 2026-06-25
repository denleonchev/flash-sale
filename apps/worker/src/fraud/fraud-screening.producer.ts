import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  FRAUD_SCREENING_QUEUE,
  FRAUD_SCREENING_JOB,
  type FraudScreeningJobPayload,
} from "@flash-sale/shared";

@Injectable()
export class FraudScreeningProducer {
  constructor(
    @InjectQueue(FRAUD_SCREENING_QUEUE)
    private readonly queue: Queue<FraudScreeningJobPayload>,
  ) {}

  async enqueue(payload: FraudScreeningJobPayload): Promise<void> {
    await this.queue.add(FRAUD_SCREENING_JOB, payload, {
      jobId: payload.orderId,
      removeOnComplete: true,
      removeOnFail: 50,
      attempts: 3,
      backoff: { type: "exponential", delay: 2_000 },
    });
  }
}
