import { Module } from "@nestjs/common";
import type { Redis } from "ioredis";
import { InventoryService, type StockCounts } from "@flash-sale/inventory";
import { createRedisConnection } from "../redis/redis.connection.js";
import { SalesModule } from "../sales/sales.module.js";
import { SalesRepository } from "../sales/sales.repository.js";

const INVENTORY_REDIS = "INVENTORY_REDIS";

async function loadStockCounts(
  salesRepo: SalesRepository,
  saleId: string,
): Promise<StockCounts | null> {
  const sale = await salesRepo.findById(saleId);
  if (!sale) return null;
  const reserved = await salesRepo.countReservedOrders(saleId);
  return { stockTotal: sale.stockTotal, sold: sale._count.orders, reserved };
}

@Module({
  imports: [SalesModule],
  providers: [
    { provide: INVENTORY_REDIS, useFactory: createRedisConnection },
    {
      provide: InventoryService,
      inject: [INVENTORY_REDIS, SalesRepository],
      useFactory: (redis: Redis, salesRepo: SalesRepository) =>
        new InventoryService(redis, (saleId) => loadStockCounts(salesRepo, saleId)),
    },
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
