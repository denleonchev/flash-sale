import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createPrismaClient } from "@flash-sale/db/client";
import type { PrismaClient } from "@flash-sale/db/client";

/**
 * NestJS DI wrapper around the generated PrismaClient. Mirrors apps/api/src/db/prisma.service.ts.
 * Access Prisma models via `prismaService.db.order`, etc.
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
