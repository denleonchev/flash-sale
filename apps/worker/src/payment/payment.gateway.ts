export interface PaymentResult {
  success: boolean;
  paymentRef: string | null;
}

export abstract class PaymentGateway {
  abstract charge(idempotencyKey: string, paymentMethodId?: string): Promise<PaymentResult>;
  // idempotencyKey is used as the Stripe refund idempotency key (NFR-2).
  abstract refund(paymentRef: string, idempotencyKey: string): Promise<void>;
}
