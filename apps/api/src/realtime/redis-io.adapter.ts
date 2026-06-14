import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { Redis } from "ioredis";
import type { Server, ServerOptions } from "socket.io";
import { createRedisConnection } from "../redis/redis.connection.js";

/**
 * Socket.IO adapter backed by Redis pub/sub. With it, a broadcast made on any api
 * instance reaches clients connected to every other instance — the core of the
 * cross-instance realtime guarantee. (NFR-10)
 *
 * Two Redis connections are required: one to publish and one to subscribe (a
 * connection in subscribe mode cannot issue normal commands). We reuse the shared
 * `createRedisConnection` helper and `duplicate()` it for the subscriber. ioredis
 * connects on its own, so no explicit `connect()` is needed.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor!: ReturnType<typeof createAdapter>;
  private pubClient?: Redis;
  private subClient?: Redis;

  async connectToRedis(): Promise<void> {
    const pubClient = createRedisConnection();
    const subClient = pubClient.duplicate();
    this.pubClient = pubClient;
    this.subClient = subClient;
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    server.adapter(this.adapterConstructor);
    return server;
  }
}
