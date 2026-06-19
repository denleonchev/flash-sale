import { ConflictException, Injectable } from "@nestjs/common";
import {
  SALE_STATES,
  type OrderResultUpdatedPayload,
} from "@flash-sale/shared";

import { SalesService } from "../sales/sales.service.js";
import { OrderProducer } from "./order.producer.js";
import { OrdersRepository } from "./orders.repository.js";
import { StockService } from "../stock/stock.service.js";
import type { CreateOrderDto } from "./dto/create-order.dto.js";

@Injectable()
export class OrdersService {
  constructor(
    private readonly orderProducer: OrderProducer,
    private readonly stockService: StockService,
    private readonly salesService: SalesService,
    private readonly ordersRepository: OrdersRepository,
  ) {}

  /**
   * Hot-path purchase flow (§4 steps 2–5):
   *   validate live → reserve Redis → enqueue → return "accepted".
   *
   * Retry semantics (FR-14, FR-16): a confirmed or sold_out order is permanent —
   * the buyer cannot buy again. A failed order releases its reserved unit and
   * ALLOWS a retry. Each retry gets a unique key (`baseKey-r{n}`) so the DB
   * UNIQUE constraint is not violated; BullMQ deduplicates double-clicks within
   * the same attempt via the shared jobId.
   */
  async buy(
    dto: CreateOrderDto,
  ): Promise<{ status: string; idempotencyKey: string }> {
    const sale = await this.salesService.getSaleById(dto.saleId);
    if (!sale || sale.state !== SALE_STATES.LIVE) {
      throw new ConflictException("sale not live");
    }

    const baseKey = `${dto.buyerId}-${dto.saleId}`;

    // Run both DB checks in parallel; confirmed/sold_out is a permanent block.
    const [successfulOrder, failedOrdersCount] = await Promise.all([
      this.ordersRepository.findSuccessfulOrder(dto.buyerId, dto.saleId),
      this.ordersRepository.countFailedOrders(dto.buyerId, dto.saleId),
    ]);
    if (successfulOrder) {
      return {
        status: "accepted",
        idempotencyKey: successfulOrder.idempotencyKey,
      };
    }

    // Retry n uses suffix -r{n}; first attempt has no suffix.
    const idempotencyKey =
      failedOrdersCount > 0 ? `${baseKey}-r${failedOrdersCount}` : baseKey;

    // BullMQ jobId deduplication: collapses double-clicks to the same in-flight job.
    if (await this.orderProducer.isEnqueued(idempotencyKey)) {
      return { status: "accepted", idempotencyKey };
    }

    const reserved = await this.stockService.reserveStock(
      dto.saleId,
      dto.quantity,
    );
    if (!reserved) {
      throw new ConflictException("sold out");
    }

    try {
      await this.orderProducer.enqueueOrderJob(
        dto.saleId,
        dto.buyerId,
        idempotencyKey,
        dto.quantity,
      );
    } catch (err) {
      // Roll back the reservation so the unit is not lost if enqueue fails.
      await this.stockService.releaseStock(dto.saleId, dto.quantity);
      throw err;
    }

    return { status: "accepted", idempotencyKey };
  }

  /** Delegates to repository; used by the gateway for FR-19 reconnect snapshot. */
  getLatestFinalizedOrder(
    buyerId: string,
    saleId: string,
  ): Promise<OrderResultUpdatedPayload | null> {
    return this.ordersRepository.getLatestFinalizedOrder(buyerId, saleId);
  }

  /** Mark the exact order as seen by id; suppresses future snapshots. (FR-19) */
  acknowledgeOrderResult(orderId: string): Promise<unknown> {
    return this.ordersRepository.acknowledgeOrderResult(orderId);
  }
}
