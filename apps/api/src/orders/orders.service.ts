import { ConflictException, Injectable } from "@nestjs/common";
import { SALE_STATES } from "@flash-sale/shared";
import { SalesService } from "../sales/sales.service.js";
import { OrderProducer } from "./order.producer.js";
import { StockService } from "../stock/stock.service.js";
import type { CreateOrderDto } from "./dto/create-order.dto.js";

@Injectable()
export class OrdersService {
  constructor(
    private readonly orderProducer: OrderProducer,
    private readonly stockService: StockService,
    private readonly salesService: SalesService,
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

    // FR-14: if the job is already in the queue this is a duplicate request — skip reservation.
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
}
