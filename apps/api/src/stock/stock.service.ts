import { Injectable, Logger } from "@nestjs/common";
import { SalesRepository } from "../sales/sales.repository.js";
import { StockRepository, getStockKey } from "./stock.repository.js";

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    private readonly stockRepo: StockRepository,
    private readonly salesRepo: SalesRepository,
  ) {}

  /**
   * Lazy init: if the Redis key is absent the counter is seeded from Postgres via
   * SET NX (atomic — only the first concurrent caller wins), then the Lua script
   * runs again. (FR-8, NFR-3)
   */
  async reserveStock(saleId: string, qty: number): Promise<boolean> {
    const key = getStockKey(saleId);
    let result = await this.stockRepo.decrementStock(key, qty);

    if (result === -1) {
      await this.initializeStock(saleId, key);
      result = await this.stockRepo.decrementStock(key, qty);
    }

    return result === 1;
  }

  async releaseStock(saleId: string, qty: number): Promise<void> {
    await this.stockRepo.incrementStock(getStockKey(saleId), qty);
  }

  private async initializeStock(saleId: string, key: string): Promise<void> {
    const sale = await this.salesRepo.findById(saleId);
    if (!sale) return;
    const reserved = await this.salesRepo.countReservedOrders(saleId);
    // FR-30: subtract reserved too, or a rebuilt counter hands held units out again.
    // The two reads are not one snapshot — see docs/technical-design/ §10 "Reserved vs sold"
    // for the accepted off-by-one windows (never an oversell).
    const available = Math.max(0, sale.stockTotal - sale._count.orders - reserved);
    await this.stockRepo.setStockIfAbsent(key, available);
    this.logger.debug(`initialized stock:${saleId} = ${available}`);
  }
}
