import { Module } from "@nestjs/common";
import { PaymentGateway } from "./payment.gateway.js";
import { StripePaymentService } from "./stripe-payment.service.js";

@Module({
  providers: [{ provide: PaymentGateway, useClass: StripePaymentService }],
  exports: [PaymentGateway],
})
export class PaymentModule {}
