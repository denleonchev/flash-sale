import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ORDER_QUEUE } from "@flash-sale/shared";
import { OrdersModule } from "../orders/orders.module.js";
import { StockModule } from "../stock/stock.module.js";
import { StripeWebhookController } from "./stripe-webhook.controller.js";
import { StripeWebhookService } from "./stripe-webhook.service.js";

@Module({
  imports: [OrdersModule, StockModule, BullModule.registerQueue({ name: ORDER_QUEUE })],
  controllers: [StripeWebhookController],
  providers: [StripeWebhookService],
})
export class StripeWebhookModule {}
