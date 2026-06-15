import { Module } from "@nestjs/common";
import { createRedisConnection } from "../redis/redis.connection.js";
import { SalesModule } from "../sales/sales.module.js";
import { StockRepository } from "./stock.repository.js";
import { StockService } from "./stock.service.js";

@Module({
  imports: [SalesModule],
  providers: [
    StockRepository,
    StockService,
    { provide: "REDIS_CLIENT", useFactory: createRedisConnection },
  ],
  exports: [StockService],
})
export class StockModule {}
