export interface PaymentResult {
  success: boolean;
  paymentRef: string | null;
}

export abstract class PaymentGateway {
  abstract charge(
    idempotencyKey: string,
    paymentMethodId?: string,
    priceCents?: number,
  ): Promise<PaymentResult>;
  // idempotencyKey is used as the Stripe refund idempotency key (NFR-2).
  abstract refund(paymentRef: string, idempotencyKey: string): Promise<void>;
  // FR-12 authorize/capture: capture or cancel an already-authorized PI.
  abstract capturePI(paymentIntentId: string, idempotencyKey: string): Promise<void>;
  abstract cancelPI(paymentIntentId: string): Promise<void>;
}
