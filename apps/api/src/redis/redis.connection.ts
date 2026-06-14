import { Redis, type RedisOptions } from "ioredis";

/**
 * Single place that builds an ioredis connection for BullMQ from `REDIS_URL`.
 * Per NFR-8 we reference the env var name, never the value.
 *
 * `maxRetriesPerRequest: null` is mandatory for BullMQ: the worker holds a
 * blocking connection (BRPOPLPUSH) while waiting for jobs, and BullMQ refuses to
 * start unless retries on that connection are disabled. The api producer shares
 * the same setting for consistency. (NFR-11)
 *
 * Shared with the realtime adapter card (S-E0.4b), which creates its own pub/sub
 * clients via this helper.
 */
export function createRedisConnection(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set");
  }
  const options: RedisOptions = { maxRetriesPerRequest: null };
  return new Redis(url, options);
}
