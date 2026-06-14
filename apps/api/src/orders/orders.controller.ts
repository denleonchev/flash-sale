import { Body, Controller, Post } from "@nestjs/common";
import { CreateOrderDto } from "./dto/create-order.dto.js";
import { OrdersService } from "./orders.service.js";

/**
 * Placeholder Buy endpoint (S-E0.4a). It only validates input and enqueues a job
 * to prove the producer→consumer path end to end. Auth, atomic stock reservation,
 * and the real purchase flow (§4) arrive in a later card — keep the controller
 * thin: validate, then delegate to the service.
 */
@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto): Promise<{ jobId: string | undefined }> {
    return this.orders.enqueue(
      dto.saleId,
      dto.buyerId,
      dto.idempotencyKey,
      dto.quantity,
    );
  }
}
