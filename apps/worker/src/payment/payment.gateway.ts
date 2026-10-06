export const PAYMENT_INTENT_STATUSES = {
  REQUIRES_PAYMENT_METHOD: "requires_payment_method",
  REQUIRES_CONFIRMATION: "requires_confirmation",
  REQUIRES_ACTION: "requires_action",
  PROCESSING: "processing",
  REQUIRES_CAPTURE: "requires_capture",
  CANCELED: "canceled",
  SUCCEEDED: "succeeded",
} as const;

export type PaymentIntentStatus =
  (typeof PAYMENT_INTENT_STATUSES)[keyof typeof PAYMENT_INTENT_STATUSES];

export abstract class PaymentGateway {
  // FR-12 authorize/capture: capture or cancel an already-authorized PI.
  abstract capturePI(paymentIntentId: string, idempotencyKey: string): Promise<void>;
  abstract cancelPI(paymentIntentId: string): Promise<void>;
  abstract retrievePIStatus(paymentIntentId: string): Promise<PaymentIntentStatus>;
}
