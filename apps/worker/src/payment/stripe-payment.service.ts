import { Injectable } from "@nestjs/common";
import Stripe from "stripe";
import { PaymentGateway, type PaymentResult } from "./payment.gateway.js";

// FR-12: fixed demo amount — the data model has no price field.
const DEMO_AMOUNT_CENTS = 100;

@Injectable()
export class StripePaymentService extends PaymentGateway {
  private readonly stripe: Stripe;

  constructor() {
    super();
    this.stripe = new Stripe(process.env["STRIPE_SECRET_KEY"]!);
  }

  async charge(idempotencyKey: string, paymentMethodId?: string): Promise<PaymentResult> {
    // Fallback allows testing without a frontend via STRIPE_PAYMENT_METHOD env var.
    const method = paymentMethodId ?? process.env["STRIPE_PAYMENT_METHOD"] ?? "pm_card_visa";
    try {
      const intent = await this.stripe.paymentIntents.create(
        {
          amount: DEMO_AMOUNT_CENTS,
          currency: "usd",
          payment_method: method,
          confirm: true,
          automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        },
        { idempotencyKey }, // NFR-2: BullMQ retry reuses the same PI without a second charge.
      );
      return { success: intent.status === "succeeded", paymentRef: intent.id };
    } catch (err) {
      if (err instanceof Stripe.errors.StripeCardError) {
        return { success: false, paymentRef: null };
      }
      throw err;
    }
  }

  // `refund-${idempotencyKey}` deduplicates the refund call on BullMQ retry (NFR-2).
  async refund(paymentRef: string, idempotencyKey: string): Promise<void> {
    await this.stripe.refunds.create(
      { payment_intent: paymentRef },
      { idempotencyKey: `refund-${idempotencyKey}` },
    );
  }
}
