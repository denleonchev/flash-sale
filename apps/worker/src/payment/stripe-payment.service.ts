import { Injectable } from "@nestjs/common";
import Stripe from "stripe";
import { PaymentGateway } from "./payment.gateway.js";

@Injectable()
export class StripePaymentService extends PaymentGateway {
  private readonly stripe: Stripe;

  constructor() {
    super();
    this.stripe = new Stripe(process.env["STRIPE_SECRET_KEY"]!);
  }

  /**
   * Idempotency (NFR-2): `cap-${idempotencyKey}` deduplicates capture on BullMQ retry.
   * If the PI is already succeeded (crash after capture but before DB commit),
   * Stripe returns the existing PI via the idempotency cache — no double charge.
   */
  async capturePI(paymentIntentId: string, idempotencyKey: string): Promise<void> {
    await this.stripe.paymentIntents.capture(paymentIntentId, undefined, {
      idempotencyKey: `cap-${idempotencyKey}`,
    });
  }

  async cancelPI(paymentIntentId: string): Promise<void> {
    try {
      await this.stripe.paymentIntents.cancel(paymentIntentId);
    } catch (err) {
      // Already cancelled or succeeded — safe to ignore; PI is no longer capturable.
      if (err instanceof Stripe.errors.StripeInvalidRequestError) return;
      throw err;
    }
  }
}
