import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import { getStockKey } from "@flash-sale/shared";

export { getStockKey };

/**
 * Atomic stock reservation via Lua.
 *
 * Returns -1 when the key is absent (caller must initialise),
 * 0 when sold out, 1 when the reservation succeeded.
 *
 * The entire script runs atomically inside Redis — no other command
 * can execute between EXISTS, GET, and DECRBY. This is the property
 * that makes concurrent reservation correct (§4 / rules/concurrency.md).
 */
const RESERVE_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end
local stock = tonumber(redis.call('GET', KEYS[1]))
if not stock or stock < tonumber(ARGV[1]) then return 0 end
redis.call('DECRBY', KEYS[1], tonumber(ARGV[1]))
return 1
`;

@Injectable()
export class StockRepository {
  constructor(@Inject("REDIS_CLIENT") private readonly redis: Redis) {}

  async decrementStock(key: string, qty: number): Promise<number> {
    return (await this.redis.eval(RESERVE_SCRIPT, 1, key, qty)) as number;
  }

  async incrementStock(key: string, qty: number): Promise<void> {
    await this.redis.incrby(key, qty);
  }

  async setStockIfAbsent(key: string, value: number): Promise<void> {
    await this.redis.set(key, value, "NX");
  }
}
