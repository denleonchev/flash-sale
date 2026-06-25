import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { FRAUD_SCREENING_QUEUE } from "@flash-sale/shared";
import { AiModule } from "../ai/ai.module.js";
import { EmbedsModule } from "../embeds/embeds.module.js";
import { FraudFlagsRepository } from "./fraud-flags.repository.js";
import { FraudScreeningProducer } from "./fraud-screening.producer.js";
import { FraudScreeningService } from "./fraud-screening.service.js";
import { FraudScreeningProcessor } from "./fraud-screening.processor.js";

@Module({
  imports: [
    BullModule.registerQueue({ name: FRAUD_SCREENING_QUEUE }),
    AiModule,
    EmbedsModule,
  ],
  providers: [
    FraudFlagsRepository,
    FraudScreeningProducer,
    FraudScreeningService,
    FraudScreeningProcessor,
  ],
  exports: [FraudFlagsRepository, FraudScreeningProducer],
})
export class FraudModule {}
