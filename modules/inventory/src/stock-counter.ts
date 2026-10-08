export const getStockKey = (saleId: string) => `stock:${saleId}`;

export const RESERVE_RESULTS = {
  KEY_MISSING: -1,
  NOT_ENOUGH: 0,
  RESERVED: 1,
} as const;

/**
 * KEYS[1] = stock key, ARGV[1] = quantity. Returns one of RESERVE_RESULTS.
 *
 * The whole script runs atomically inside Redis — no other command can execute between
 * EXISTS, GET and DECRBY. That is what makes concurrent reservation correct (§4).
 */
export const RESERVE_STOCK_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end
local stock = tonumber(redis.call('GET', KEYS[1]))
if not stock or stock < tonumber(ARGV[1]) then return 0 end
redis.call('DECRBY', KEYS[1], tonumber(ARGV[1]))
return 1
`;

/**
 * Releases reserved units back to the counter — only if the key exists. (FR-16, FR-30)
 * KEYS[1] = stock key, ARGV[1] = quantity. Returns the new count, or -1 when skipped.
 *
 * A plain INCRBY on a missing key would create it with the value 1 and block the rebuild
 * from Postgres, leaving the sale with one unit. Skipping is safe: the order row is always
 * updated before the release, so the next rebuild no longer counts it as reserved.
 */
export const RELEASE_STOCK_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end
return redis.call('INCRBY', KEYS[1], tonumber(ARGV[1]))
`;
