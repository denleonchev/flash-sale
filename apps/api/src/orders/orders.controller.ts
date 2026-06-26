import { Body, Controller, Post } from "@nestjs/common";
import { CreateOrderDto } from "./dto/create-order.dto.js";
import { OrdersService } from "./orders.service.js";

/** POST /orders — atomic stock reservation + enqueue (§4 steps 2–5). */
@Controller("orders")
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Post()
  buy(@Body() dto: CreateOrderDto): Promise<{ status: string; idempotencyKey: string }> {
    return this.service.buy(dto);
  }
}
