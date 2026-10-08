import { randomUUID } from "node:crypto";
import { Redis } from "ioredis";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { InventoryService, type StockCounts } from "./inventory.service.js";
import { getStockKey } from "./stock-counter.js";

/**
 * Runs against a real Redis: the guarantees under test (atomic Lua scripts, SET NX) live
 * there, not in our code. Needs REDIS_URL pointing at a local instance.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function assertLocalRedis(): string {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  if (!LOCAL_HOSTS.has(new URL(url).hostname)) {
    throw new Error("REDIS_URL must point at localhost — this test writes stock counters");
  }
  return url;
}

describe("InventoryService", () => {
  let redis: Redis;
  let inventory: InventoryService;

  const countsBySale = new Map<string, StockCounts>();
  const loadStockCounts = vi.fn(async (saleId: string) => countsBySale.get(saleId) ?? null);

  function createSale(counts: StockCounts): string {
    const saleId = randomUUID();
    countsBySale.set(saleId, counts);
    return saleId;
  }

  async function readCounter(saleId: string): Promise<number | null> {
    const value = await redis.get(getStockKey(saleId));
    return value === null ? null : Number(value);
  }

  async function reserveConcurrently(saleId: string, buyers: number): Promise<number> {
    const results = await Promise.all(
      Array.from({ length: buyers }, () => inventory.reserveStock(saleId, 1)),
    );
    return results.filter(Boolean).length;
  }

  beforeAll(() => {
    redis = new Redis(assertLocalRedis());
    inventory = new InventoryService(redis, loadStockCounts);
  });

  afterEach(async () => {
    const keys = [...countsBySale.keys()].map(getStockKey);
    if (keys.length > 0) await redis.del(...keys);
    countsBySale.clear();
    loadStockCounts.mockClear();
  });

  afterAll(async () => {
    await redis.quit();
  });

  describe("reserveStock", () => {
    it("seeds a missing counter with total minus sold minus reserved", async () => {
      const saleId = createSale({ stockTotal: 5, sold: 1, reserved: 1 });

      expect(await inventory.reserveStock(saleId, 1)).toBe(true);
      expect(await readCounter(saleId)).toBe(2);
    });

    it("does not reload the counts once the counter exists", async () => {
      const saleId = createSale({ stockTotal: 5, sold: 0, reserved: 0 });

      await inventory.reserveStock(saleId, 1);
      await inventory.reserveStock(saleId, 1);

      expect(loadStockCounts).toHaveBeenCalledTimes(1);
      expect(await readCounter(saleId)).toBe(3);
    });

    it("refuses when nothing is left and keeps the counter at zero", async () => {
      const saleId = createSale({ stockTotal: 2, sold: 1, reserved: 1 });

      expect(await inventory.reserveStock(saleId, 1)).toBe(false);
      expect(await readCounter(saleId)).toBe(0);
    });

    it("refuses for an unknown sale and creates no counter", async () => {
      const saleId = randomUUID();

      expect(await inventory.reserveStock(saleId, 1)).toBe(false);
      expect(await readCounter(saleId)).toBeNull();
    });

    it("throws when the counter is missing and no counts loader was given", async () => {
      const releaseOnlyInventory = new InventoryService(redis);

      await expect(releaseOnlyInventory.reserveStock(randomUUID(), 1)).rejects.toThrow(
        "loadStockCounts",
      );
    });

    it("lets exactly as many concurrent buyers through as there are units", async () => {
      const saleId = createSale({ stockTotal: 5, sold: 0, reserved: 0 });
      await inventory.reserveStock(saleId, 1);
      await inventory.releaseStock(saleId, 1);

      expect(await reserveConcurrently(saleId, 30)).toBe(5);
      expect(await readCounter(saleId)).toBe(0);
    });

    it("lets exactly as many concurrent buyers through when the counter is missing", async () => {
      const saleId = createSale({ stockTotal: 5, sold: 0, reserved: 0 });

      expect(await reserveConcurrently(saleId, 30)).toBe(5);
      expect(await readCounter(saleId)).toBe(0);
    });
  });

  describe("releaseStock", () => {
    it("returns a unit to an existing counter", async () => {
      const saleId = createSale({ stockTotal: 3, sold: 0, reserved: 0 });
      await inventory.reserveStock(saleId, 1);

      await inventory.releaseStock(saleId, 1);

      expect(await readCounter(saleId)).toBe(3);
    });

    it("does not create a missing counter", async () => {
      const saleId = createSale({ stockTotal: 3, sold: 0, reserved: 0 });

      await inventory.releaseStock(saleId, 1);

      expect(await readCounter(saleId)).toBeNull();
    });
  });
});
