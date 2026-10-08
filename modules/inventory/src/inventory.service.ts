import type { Redis } from "ioredis";
import {
  RELEASE_STOCK_SCRIPT,
  RESERVE_RESULTS,
  RESERVE_STOCK_SCRIPT,
  getStockKey,
} from "./stock-counter.js";

export interface StockCounts {
  stockTotal: number;
  sold: number;
  reserved: number;
}

/** Returns null when the sale does not exist. */
export type LoadStockCounts = (saleId: string) => Promise<StockCounts | null>;

export class InventoryService {
  constructor(
    private readonly redis: Redis,
    // Needed only to reserve: a host that just releases stock may omit it.
    private readonly loadStockCounts?: LoadStockCounts,
  ) {}

  /**
   * Lazy init: if the Redis key is absent the counter is seeded from Postgres via
   * SET NX (atomic — only the first concurrent caller wins), then the Lua script
   * runs again. (FR-8, NFR-3)
   */
  async reserveStock(saleId: string, qty: number): Promise<boolean> {
    let result = await this.runReserveScript(saleId, qty);

    if (result === RESERVE_RESULTS.KEY_MISSING) {
      await this.seedStockCounter(saleId);
      result = await this.runReserveScript(saleId, qty);
    }

    return result === RESERVE_RESULTS.RESERVED;
  }

  async releaseStock(saleId: string, qty: number): Promise<void> {
    await this.redis.eval(RELEASE_STOCK_SCRIPT, 1, getStockKey(saleId), qty);
  }

  private async runReserveScript(saleId: string, qty: number): Promise<number> {
    return (await this.redis.eval(RESERVE_STOCK_SCRIPT, 1, getStockKey(saleId), qty)) as number;
  }

  private async seedStockCounter(saleId: string): Promise<void> {
    if (!this.loadStockCounts) {
      throw new Error("InventoryService cannot reserve stock without loadStockCounts");
    }
    const counts = await this.loadStockCounts(saleId);
    if (!counts) return;
    // FR-30: subtract reserved too, or a rebuilt counter hands held units out again.
    // The counts are not one snapshot — see docs/technical-design/ §10 "Reserved vs sold"
    // for the accepted off-by-one windows (never an oversell).
    const available = Math.max(0, counts.stockTotal - counts.sold - counts.reserved);
    await this.redis.set(getStockKey(saleId), available, "NX");
  }
}
