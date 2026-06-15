import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createPrismaClient } from "@flash-sale/db/client";
import type { PrismaClient } from "@flash-sale/db/client";

/**
 * NestJS DI wrapper around the generated PrismaClient. Uses composition so the
 * adapter setup stays in @flash-sale/db — api has no direct dep on adapter-pg.
 * Access Prisma models via `prismaService.db.sale`, `prismaService.db.order`, etc.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly db: PrismaClient;

  constructor() {
    this.db = createPrismaClient();
  }

  async onModuleInit(): Promise<void> {
    await this.db.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.db.$disconnect();
  }
}
