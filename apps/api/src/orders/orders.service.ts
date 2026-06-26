import { ConflictException, Injectable } from "@nestjs/common";
import {
  ORDER_STATUSES,
  SALE_STATES,
  type OrderResultUpdatedPayload,
  type Sale,
} from "@flash-sale/shared";

import { SalesService } from "../sales/sales.service.js";
import { UsersService } from "../users/users.service.js";
import { OrderProducer } from "./order.producer.js";
import { OrderResultPublisher } from "./order-result.publisher.js";
import { OrdersRepository } from "./orders.repository.js";
import { StockService } from "../stock/stock.service.js";
import type { CreateOrderDto } from "./dto/create-order.dto.js";

/** P2002 = unique constraint violation in Prisma. */
function isPrismaUniqueError(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002"
  );
}

type BuyResult = { status: string; idempotencyKey: string };

@Injectable()
export class OrdersService {
  constructor(
    private readonly orderProducer: OrderProducer,
    private readonly orderResultPublisher: OrderResultPublisher,
    private readonly stockService: StockService,
    private readonly salesService: SalesService,
    private readonly ordersRepository: OrdersRepository,
    private readonly usersService: UsersService,
  ) {}

  async buy(dto: CreateOrderDto): Promise<BuyResult> {
    await this.usersService.upsertBuyer(dto.buyerId, dto.email, dto.name);
    const sale = await this.assertSaleLive(dto.saleId);

    // Non-failed order (in_progress/confirmed/sold_out) is a permanent block.
    const blocking = await this.ordersRepository.findBlockingOrder(dto.buyerId, dto.saleId);
    if (blocking) return { status: "accepted", idempotencyKey: blocking.idempotencyKey };

    const idempotencyKey = await this.buildIdempotencyKey(dto.buyerId, dto.saleId);
    return this.executeOrder(dto, idempotencyKey, sale.priceCents);
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

  // FR-3: reject unless the sale is currently live.
  private async assertSaleLive(saleId: string): Promise<Sale> {
    const sale = await this.salesService.getSaleById(saleId);
    if (!sale) {
      throw new ConflictException("sale not found");
    }
    if (sale.state !== SALE_STATES.LIVE) {
      const reason =
        sale.state === SALE_STATES.UPCOMING ? "sale not started yet" : "sale has ended";
      throw new ConflictException(reason);
    }
    return sale;
  }

  // FR-14, FR-16: retry gets a unique suffix so the UNIQUE constraint is not violated across attempts.
  private async buildIdempotencyKey(buyerId: string, saleId: string): Promise<string> {
    const base = `${buyerId}-${saleId}`;
    const failedCount = await this.ordersRepository.countFailedOrders(buyerId, saleId);
    return failedCount > 0 ? `${base}-r${failedCount}` : base;
  }

  /**
   * Concurrency (§4 plan, .claude/rules/concurrency.md):
   * - Redis DECR is the sold-out gate — atomic, before any DB write. (FR-8, FR-15)
   * - UNIQUE(idempotency_key) on INSERT is the double-click dedup: two concurrent
   *   requests both past findBlockingOrder race here; the loser gets P2002,
   *   releases its extra reservation, and returns accepted.
   * - Enqueue failure rolls back: deleteOrder + releaseStock so no orphan
   *   in_progress row is left without a job to resolve it.
   */
  private async executeOrder(
    dto: CreateOrderDto,
    idempotencyKey: string,
    priceCents: number,
  ): Promise<BuyResult> {
    const reserved = await this.stockService.reserveStock(dto.saleId, dto.quantity);
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
      if (isPrismaUniqueError(e)) return { status: "accepted", idempotencyKey };
      throw e;
    }

    try {
      await this.orderProducer.enqueueOrderJob(
        dto.saleId,
        dto.buyerId,
        idempotencyKey,
        dto.quantity,
        priceCents,
        dto.paymentMethodId,
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
}
