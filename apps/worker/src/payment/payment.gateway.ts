export abstract class PaymentGateway {
  // FR-12 authorize/capture: capture or cancel an already-authorized PI.
  abstract capturePI(paymentIntentId: string, idempotencyKey: string): Promise<void>;
  abstract cancelPI(paymentIntentId: string): Promise<void>;
}
