import { ConflictException, Injectable } from "@nestjs/common";
import { SALE_STATES, type OrderResultUpdatedPayload } from "@flash-sale/shared";
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
   * idempotencyKey = buyerId + saleId so BullMQ collapses duplicate Buy
   * requests (e.g. double-click) into a single job. (FR-14, NFR-2)
   */
  async buy(
    dto: CreateOrderDto,
  ): Promise<{ status: string; idempotencyKey: string }> {
    const sale = await this.salesService.getSaleById(dto.saleId);
    if (!sale || sale.state !== SALE_STATES.LIVE) {
      throw new ConflictException("sale not live");
    }

    const idempotencyKey = `${dto.buyerId}-${dto.saleId}`;

    // FR-14: parallel check — BullMQ (in-queue/active) and DB (already finalized).
    // DB backstop needed because removeOnComplete:true removes completed jobs from
    // BullMQ, so isEnqueued returns false for a finished order; without the DB check
    // a second buy would decrement Redis stock and leak a unit when the worker hits P2002.
    const [enqueued, finalized] = await Promise.all([
      this.orderProducer.isEnqueued(idempotencyKey),
      this.ordersRepository.findByIdempotencyKey(idempotencyKey),
    ]);
    if (enqueued || finalized) {
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
  ): Promise<OrderResultUpdatedPayload | null> {
    return this.ordersRepository.getLatestFinalizedOrder(buyerId);
  }
}
