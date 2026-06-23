import { Module } from "@nestjs/common";
import { PaymentGateway } from "./payment.gateway.js";
import { FakePaymentService } from "./fake-payment.service.js";
import { StripePaymentService } from "./stripe-payment.service.js";

@Module({
  providers: [
    {
      provide: PaymentGateway,
      useFactory: (): PaymentGateway =>
        process.env["PAYMENT_PROVIDER"] === "stripe"
          ? new StripePaymentService()
          : new FakePaymentService(),
    },
  ],
  exports: [PaymentGateway],
})
export class PaymentModule {}
