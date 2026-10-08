import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { BullModule, getQueueToken } from "@nestjs/bullmq";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderStatus } from "@flash-sale/db/client";
import { ORDER_QUEUE } from "@flash-sale/shared";
import { getStockKey } from "@flash-sale/inventory";
import { DbModule } from "../db/db.module.js";
import { InventoryModule } from "../inventory/inventory.module.js";
import { PrismaService } from "../db/prisma.service.js";
import {
  PAYMENT_INTENT_STATUSES,
  PaymentGateway,
  type PaymentIntentStatus,
} from "../payment/payment.gateway.js";
import { PaymentModule } from "../payment/payment.module.js";
import { OrderResultPublisher } from "../realtime/order-result.publisher.js";
import { createRedisConnection } from "../redis/redis.connection.js";
import { OrderReconciliationService } from "./order-reconciliation.service.js";
import { OrdersRepository } from "./orders.repository.js";

/**
 * Runs against a real Postgres and Redis: the guarantees under test (guarded UPDATE,
 * INCRBY gated by didTransition, jobId dedup) live there, not in our code. Only the
 * payment provider is faked.
 *
 * Needs DATABASE_URL / REDIS_URL pointing at local instances with migrations applied,
 * and no worker running against the same database — a live reconciliation run would
 * race the test for its orders.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const STALE_ORDER_AGE_MS = 10 * 60_000;
const INITIAL_STOCK = 3;
// Keeps test jobs out of the keys a real worker on the same Redis consumes.
const TEST_QUEUE_PREFIX = "test-order-reconciliation";

function assertLocalInfra(): void {
  for (const name of ["DATABASE_URL", "REDIS_URL"]) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not set`);
    if (!LOCAL_HOSTS.has(new URL(value).hostname)) {
      throw new Error(`${name} must point at localhost — this test writes orders and stock`);
    }
  }
}

describe("OrderReconciliationService", () => {
  let moduleRef: TestingModule;
  let queueConnection: Redis;
  let redis: Redis;
  let prisma: PrismaService;
  let service: OrderReconciliationService;
  let ordersRepo: OrdersRepository;
  let captureQueue: Queue;

  const piStatuses = new Map<string, PaymentIntentStatus>();
  let runBeforeStatusReturns: (paymentIntentId: string) => Promise<void> = async () => {};

  const paymentGateway = {
    // Orders this test did not create are reported as `processing`, which reconciliation
    // leaves untouched — leftovers in a dev database are not finalized by the fake.
    retrievePIStatus: vi.fn(async (paymentIntentId: string) => {
      const status = piStatuses.get(paymentIntentId);
      if (!status) return PAYMENT_INTENT_STATUSES.PROCESSING;
      await runBeforeStatusReturns(paymentIntentId);
      return status;
    }),
    capturePI: vi.fn(async () => {}),
    cancelPI: vi.fn(async () => {}),
  } satisfies PaymentGateway;

  const saleIds: string[] = [];

  async function seedOrder(piStatus: PaymentIntentStatus, ageMs = STALE_ORDER_AGE_MS) {
    const now = Date.now();
    const sale = await prisma.db.sale.create({
      data: {
        title: `reconciliation test ${randomUUID()}`,
        stockTotal: 5,
        priceCents: 1000,
        startsAt: new Date(now - 3_600_000),
        endsAt: new Date(now + 3_600_000),
      },
    });
    saleIds.push(sale.id);

    const paymentRef = `pi_test_${randomUUID()}`;
    const order = await prisma.db.order.create({
      data: {
        saleId: sale.id,
        buyerId: `test-buyer-${randomUUID()}`,
        idempotencyKey: `test-${randomUUID()}`,
        status: OrderStatus.in_progress,
        paymentRef,
        createdAt: new Date(now - ageMs),
      },
    });

    piStatuses.set(paymentRef, piStatus);
    await redis.set(getStockKey(sale.id), INITIAL_STOCK);
    return { orderId: order.id, saleId: sale.id, paymentRef };
  }

  async function readOrderStatus(orderId: string): Promise<OrderStatus> {
    const order = await prisma.db.order.findUniqueOrThrow({ where: { id: orderId } });
    return order.status;
  }

  async function readStock(saleId: string): Promise<number> {
    return Number(await redis.get(getStockKey(saleId)));
  }

  beforeAll(async () => {
    assertLocalInfra();
    delete process.env["ORDER_RECONCILE_AFTER_MINUTES"];

    queueConnection = createRedisConnection();
    redis = createRedisConnection();

    moduleRef = await Test.createTestingModule({
      imports: [
        DbModule,
        BullModule.forRoot({ connection: queueConnection, prefix: TEST_QUEUE_PREFIX }),
        BullModule.registerQueue({ name: ORDER_QUEUE }),
        PaymentModule,
        InventoryModule,
      ],
      providers: [OrderReconciliationService, OrdersRepository, OrderResultPublisher],
    })
      .overrideProvider(PaymentGateway)
      .useValue(paymentGateway)
      .compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(OrderReconciliationService);
    ordersRepo = moduleRef.get(OrdersRepository);
    captureQueue = moduleRef.get<Queue>(getQueueToken(ORDER_QUEUE));
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    piStatuses.clear();
    runBeforeStatusReturns = async () => {};
    await captureQueue.obliterate({ force: true });
  });

  afterAll(async () => {
    await captureQueue.obliterate({ force: true });
    await prisma.db.order.deleteMany({ where: { saleId: { in: saleIds } } });
    await prisma.db.sale.deleteMany({ where: { id: { in: saleIds } } });
    if (saleIds.length > 0) await redis.del(...saleIds.map(getStockKey));
    await moduleRef.close();
    await redis.quit();
    await queueConnection.quit();
  });

  it("enqueues one capture job for an authorized PI, however many runs see it", async () => {
    const { orderId, saleId } = await seedOrder(PAYMENT_INTENT_STATUSES.REQUIRES_CAPTURE);

    await service.reconcileStaleOrders();
    await service.reconcileStaleOrders();

    const jobs = await captureQueue.getJobs(["waiting", "active", "delayed", "prioritized"]);
    expect(jobs.filter((job) => job.id === orderId)).toHaveLength(1);
    expect(await readOrderStatus(orderId)).toBe(OrderStatus.in_progress);
    expect(await readStock(saleId)).toBe(INITIAL_STOCK);
    expect(paymentGateway.capturePI).not.toHaveBeenCalled();
    expect(paymentGateway.cancelPI).not.toHaveBeenCalled();
  });

  it("expires an abandoned order, releases its unit and cancels the PI", async () => {
    const { orderId, saleId, paymentRef } = await seedOrder(
      PAYMENT_INTENT_STATUSES.REQUIRES_CONFIRMATION,
    );

    await service.reconcileStaleOrders();

    expect(await readOrderStatus(orderId)).toBe(OrderStatus.expired);
    expect(await readStock(saleId)).toBe(INITIAL_STOCK + 1);
    expect(paymentGateway.cancelPI).toHaveBeenCalledTimes(1);
    expect(paymentGateway.cancelPI).toHaveBeenCalledWith(paymentRef);
  });

  it("does not recreate a lost stock key when it releases a unit", async () => {
    const { orderId, saleId } = await seedOrder(PAYMENT_INTENT_STATUSES.REQUIRES_CONFIRMATION);
    await redis.del(getStockKey(saleId));

    await service.reconcileStaleOrders();

    expect(await readOrderStatus(orderId)).toBe(OrderStatus.expired);
    expect(await redis.exists(getStockKey(saleId))).toBe(0);
  });

  it("lets only one of two concurrent closes transition the order", async () => {
    const { orderId } = await seedOrder(PAYMENT_INTENT_STATUSES.REQUIRES_CONFIRMATION);

    const results = await Promise.all([
      ordersRepo.closeInProgressOrder(orderId, OrderStatus.expired),
      ordersRepo.closeInProgressOrder(orderId, OrderStatus.failed),
    ]);

    expect(results.filter((result) => result.didTransition)).toHaveLength(1);
  });

  it("does nothing when the failure webhook finalizes the order first", async () => {
    const { orderId, saleId } = await seedOrder(PAYMENT_INTENT_STATUSES.REQUIRES_CONFIRMATION);
    runBeforeStatusReturns = async () => {
      await prisma.db.order.updateMany({
        where: { id: orderId, status: OrderStatus.in_progress },
        data: { status: OrderStatus.failed },
      });
    };

    await service.reconcileStaleOrders();

    expect(await readOrderStatus(orderId)).toBe(OrderStatus.failed);
    expect(await readStock(saleId)).toBe(INITIAL_STOCK);
    expect(paymentGateway.cancelPI).not.toHaveBeenCalled();
  });

  it("leaves an order younger than the threshold alone", async () => {
    const { orderId, saleId, paymentRef } = await seedOrder(
      PAYMENT_INTENT_STATUSES.REQUIRES_CONFIRMATION,
      30_000,
    );

    await service.reconcileStaleOrders();

    expect(await readOrderStatus(orderId)).toBe(OrderStatus.in_progress);
    expect(await readStock(saleId)).toBe(INITIAL_STOCK);
    expect(paymentGateway.retrievePIStatus).not.toHaveBeenCalledWith(paymentRef);
  });

  describe("reconcileOrderById", () => {
    const YOUNG_ORDER_AGE_MS = 30_000;

    it("expires an unauthorized order regardless of its age", async () => {
      const { orderId, saleId, paymentRef } = await seedOrder(
        PAYMENT_INTENT_STATUSES.REQUIRES_ACTION,
        YOUNG_ORDER_AGE_MS,
      );

      await service.reconcileOrderById(orderId);

      expect(await readOrderStatus(orderId)).toBe(OrderStatus.expired);
      expect(await readStock(saleId)).toBe(INITIAL_STOCK + 1);
      expect(paymentGateway.cancelPI).toHaveBeenCalledTimes(1);
      expect(paymentGateway.cancelPI).toHaveBeenCalledWith(paymentRef);
    });

    it("sends an authorized order to capture instead of expiring it", async () => {
      const { orderId, saleId } = await seedOrder(
        PAYMENT_INTENT_STATUSES.REQUIRES_CAPTURE,
        YOUNG_ORDER_AGE_MS,
      );

      await service.reconcileOrderById(orderId);

      expect(await captureQueue.getJob(orderId)).toBeDefined();
      expect(await readOrderStatus(orderId)).toBe(OrderStatus.in_progress);
      expect(await readStock(saleId)).toBe(INITIAL_STOCK);
      expect(paymentGateway.cancelPI).not.toHaveBeenCalled();
    });

    it("ignores an order that is no longer in_progress", async () => {
      const { orderId, saleId, paymentRef } = await seedOrder(
        PAYMENT_INTENT_STATUSES.REQUIRES_CONFIRMATION,
        YOUNG_ORDER_AGE_MS,
      );
      await prisma.db.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.confirmed },
      });

      await service.reconcileOrderById(orderId);

      expect(await readOrderStatus(orderId)).toBe(OrderStatus.confirmed);
      expect(await readStock(saleId)).toBe(INITIAL_STOCK);
      expect(paymentGateway.retrievePIStatus).not.toHaveBeenCalledWith(paymentRef);
    });
  });
});
