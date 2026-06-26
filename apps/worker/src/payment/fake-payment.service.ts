import { Injectable } from "@nestjs/common";
import { PaymentGateway, type PaymentResult } from "./payment.gateway.js";

@Injectable()
export class FakePaymentService extends PaymentGateway {
  // FR-11: PAYMENT_FAIL_RATE env var (0.0–1.0, default 0 = always succeed).
  charge(
    _idempotencyKey: string,
    _paymentMethodId?: string,
    _priceCents?: number,
  ): Promise<PaymentResult> {
    const failRate = parseFloat(process.env["PAYMENT_FAIL_RATE"] ?? "0");
    return Promise.resolve({ success: Math.random() >= failRate, paymentRef: null });
  }

  refund(): Promise<void> {
    return Promise.resolve();
  }
}
