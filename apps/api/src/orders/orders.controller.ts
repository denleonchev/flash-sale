import { Body, Controller, Post } from "@nestjs/common";
import { CreateOrderDto } from "./dto/create-order.dto.js";
import { OrdersService, type BuyResult } from "./orders.service.js";

/** POST /orders — reserve stock, create PI (Stripe) or enqueue (fake). */
@Controller("orders")
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Post()
  buy(@Body() dto: CreateOrderDto): Promise<BuyResult> {
    return this.service.buy(dto);
  }
}
