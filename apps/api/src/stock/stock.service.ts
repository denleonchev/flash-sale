import { Injectable, Logger } from "@nestjs/common";
import { SalesRepository } from "../sales/sales.repository.js";
import { StockRepository, stockKey } from "./stock.repository.js";

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    private readonly stockRepo: StockRepository,
    private readonly salesRepo: SalesRepository,
  ) {}

  /**
   * Reserve `qty` units for `saleId`. Returns true on success, false when sold out.
   *
   * Lazy initialisation: if the Redis key is absent the counter is seeded from
   * Postgres (stockTotal − confirmedOrders) using SET NX, then the Lua script
   * runs again. SET NX is atomic — only the first concurrent caller wins; the
   * rest see the key already set and proceed normally. (FR-7, NFR-3)
   */
  async reserveStock(saleId: string, qty: number): Promise<boolean> {
    const key = stockKey(saleId);
    let result = await this.stockRepo.decrementStock(key, qty);

    if (result === -1) {
      await this.initializeStock(saleId, key);
      result = await this.stockRepo.decrementStock(key, qty);
    }

    return result === 1;
  }

  /** Release `qty` units back to the counter (used on enqueue failure). */
  async releaseStock(saleId: string, qty: number): Promise<void> {
    await this.stockRepo.incrementStock(stockKey(saleId), qty);
  }

  private async initializeStock(saleId: string, key: string): Promise<void> {
    const sale = await this.salesRepo.findById(saleId);
    if (!sale) return;
    const remaining = Math.max(0, sale.stockTotal - sale._count.orders);
    await this.stockRepo.setStockIfAbsent(key, remaining);
    this.logger.debug(`initialized stock:${saleId} = ${remaining}`);
  }
}
