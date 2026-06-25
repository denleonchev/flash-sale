import { Module } from "@nestjs/common";
import { FraudFlagsController } from "./fraud-flags.controller.js";
import { FraudFlagsService } from "./fraud-flags.service.js";
import { FraudFlagsRepository } from "./fraud-flags.repository.js";

@Module({
  controllers: [FraudFlagsController],
  providers: [FraudFlagsService, FraudFlagsRepository],
})
export class FraudFlagsModule {}
