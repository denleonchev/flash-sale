import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { AbandonCheckoutDto } from "./dto/abandon-checkout.dto.js";
import { CreateOrderDto } from "./dto/create-order.dto.js";
import { OrdersService, type AbandonCheckoutResult, type BuyResult } from "./orders.service.js";

/** POST /orders — reserve stock, create PI (Stripe) or enqueue (fake). */
@Controller("orders")
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Post()
  buy(@Body() dto: CreateOrderDto): Promise<BuyResult> {
    return this.service.buy(dto);
  }

  // 202: the order is closed later by the worker, not within this request. (FR-29)
  @Post("abandon")
  @HttpCode(202)
  abandonCheckout(@Body() dto: AbandonCheckoutDto): Promise<AbandonCheckoutResult> {
    return this.service.abandonCheckout(dto);
  }
}
