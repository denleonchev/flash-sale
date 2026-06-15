import { Module } from "@nestjs/common";
import { SalesController } from "./sales.controller.js";
import { SalesService } from "./sales.service.js";
import { SalesRepository } from "./sales.repository.js";

@Module({
  controllers: [SalesController],
  providers: [SalesService, SalesRepository],
  exports: [SalesService, SalesRepository],
})
export class SalesModule {}
