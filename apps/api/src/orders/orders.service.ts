import { ConflictException, Injectable } from "@nestjs/common";
import {
  ORDER_STATUSES,
  SALE_STATES,
  type OrderResultUpdatedPayload,
} from "@flash-sale/shared";

import { SalesService } from "../sales/sales.service.js";
import { OrderProducer } from "./order.producer.js";
import { OrderResultPublisher } from "./order-result.publisher.js";
import { OrdersRepository } from "./orders.repository.js";
import { StockService } from "../stock/stock.service.js";
import type { CreateOrderDto } from "./dto/create-order.dto.js";

/** P2002 = unique constraint violation in Prisma. */
function isPrismaUniqueError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: unknown }).code === "P2002"
  );
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly orderProducer: OrderProducer,
    private readonly orderResultPublisher: OrderResultPublisher,
    private readonly stockService: StockService,
    private readonly salesService: SalesService,
    private readonly ordersRepository: OrdersRepository,
  ) {}

  /**
   * Retry semantics (FR-14, FR-16): in_progress/confirmed/sold_out are permanent
   * blocks. A failed order releases its reserved unit and ALLOWS a retry. Each
   * retry gets a unique key (`baseKey-r{n}`) so the UNIQUE constraint is not
   * violated across attempts.
   *
   * Concurrency (§4 plan, .claude/rules/concurrency.md):
   * - Redis DECR is the sold-out gate — atomic, before any DB write.
   * - UNIQUE(idempotency_key) on INSERT is the double-click dedup: two concurrent
   *   requests both past findBlockingOrder race here; the loser gets P2002,
   *   releases its extra reservation, and returns accepted.
   * - Enqueue failure rolls back: deleteOrder + releaseStock so no orphan
   *   in_progress row is left without a job to resolve it.
   */
  async buy(
    dto: CreateOrderDto,
  ): Promise<{ status: string; idempotencyKey: string }> {
    const sale = await this.salesService.getSaleById(dto.saleId);
    if (!sale) {
      throw new ConflictException("sale not found");
    }
    if (sale.state !== SALE_STATES.LIVE) {
      const reason =
        sale.state === SALE_STATES.UPCOMING ? "sale not started yet" : "sale has ended";
      throw new ConflictException(reason);
    }

    const baseKey = `${dto.buyerId}-${dto.saleId}`;

    // Non-failed order (in_progress/confirmed/sold_out) is a permanent block.
    const blockingOrder = await this.ordersRepository.findBlockingOrder(
      dto.buyerId,
      dto.saleId,
    );
    if (blockingOrder) {
      return { status: "accepted", idempotencyKey: blockingOrder.idempotencyKey };
    }

    const failedOrdersCount = await this.ordersRepository.countFailedOrders(
      dto.buyerId,
      dto.saleId,
    );
    const idempotencyKey =
      failedOrdersCount > 0 ? `${baseKey}-r${failedOrdersCount}` : baseKey;

    // Sold-out gate: atomic Redis DECR, no DB row created if it fails. (FR-8, FR-15)
    const reserved = await this.stockService.reserveStock(
      dto.saleId,
      dto.quantity,
    );
    if (!reserved) {
      throw new ConflictException("sold out");
    }

    let orderId: string;
    try {
      const created = await this.ordersRepository.createInProgressOrder(
        dto.buyerId,
        dto.saleId,
        idempotencyKey,
      );
      orderId = created.orderId;
    } catch (e) {
      // P2002: double-click lost the INSERT race → release extra reservation.
      await this.stockService.releaseStock(dto.saleId, dto.quantity);
      if (isPrismaUniqueError(e)) {
        return { status: "accepted", idempotencyKey };
      }
      throw e;
    }

    try {
      await this.orderProducer.enqueueOrderJob(
        dto.saleId,
        dto.buyerId,
        idempotencyKey,
        dto.quantity,
      );
    } catch (err) {
      // Enqueue failed: orphan in_progress row would block all future retries.
      await this.ordersRepository.deleteOrder(orderId);
      await this.stockService.releaseStock(dto.saleId, dto.quantity);
      throw err;
    }

    await this.orderResultPublisher.publishOrderResult({
      buyerId: dto.buyerId,
      saleId: dto.saleId,
      status: ORDER_STATUSES.IN_PROGRESS,
      orderId,
    });

    return { status: "accepted", idempotencyKey };
  }

  getLatestFinalizedOrder(
    buyerId: string,
    saleId: string,
  ): Promise<OrderResultUpdatedPayload | null> {
    return this.ordersRepository.getLatestFinalizedOrder(buyerId, saleId);
  }

  acknowledgeOrderResult(orderId: string): Promise<unknown> {
    return this.ordersRepository.acknowledgeOrderResult(orderId);
  }
}
