import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { context, propagation } from "@opentelemetry/api";
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
    const carrier: Record<string, string> = {};
    propagation.inject(context.active(), carrier);

    await this.queue.add(
      FRAUD_SCREENING_JOB,
      { ...payload, traceparent: carrier["traceparent"] },
      {
        jobId: payload.orderId,
        removeOnComplete: true,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: "exponential", delay: 2_000 },
      },
    );
  }
}
