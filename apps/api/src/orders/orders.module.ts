import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ORDER_QUEUE } from "@flash-sale/shared";
import { OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";

/**
 * Orders feature (producer). Declares the `orders` queue it writes to via
 * `registerQueue` (the connection comes from the global QueueModule's forRoot).
 */
@Module({
  imports: [BullModule.registerQueue({ name: ORDER_QUEUE })],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
