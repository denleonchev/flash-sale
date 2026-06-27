import Stripe from "stripe";
import type { RunConfig } from "./config.js";
import type { BuyOutcome } from "./stripe-buyer-swarm.js";

export class WebhookPoster {
  constructor(private readonly config: RunConfig) {}

  // Fire all confirms + webhook posts concurrently — maximises stress on the worker's
  // SELECT FOR UPDATE guard. (concurrency.md)
  async confirmAndPostAll(accepted: BuyOutcome[]): Promise<void> {
    await Promise.all(accepted.map((o) => this.confirmAndPost(o.clientSecret)));
  }

  private async confirmAndPost(clientSecret: string): Promise<void> {
    // clientSecret format: pi_XXXXX_secret_YYYYY — extract the PI id.
    const piId = clientSecret.split("_secret_")[0]!;

    let pi: Stripe.PaymentIntent;
    try {
      // Confirm server-side — equivalent to stripe.confirmCardPayment() in the browser.
      // pm_card_visa skips 3DS and moves the PI directly to requires_capture.
      pi = await this.config.stripe.paymentIntents.confirm(piId);
    } catch {
      return; // PI was already cancelled (e.g. double-click loser) — nothing to do.
    }

    if (pi.status !== "requires_capture") return;

    const payload = JSON.stringify({
      id: `evt_test_${piId}`,
      object: "event",
      api_version: "2025-05-28.basil",
      type: "payment_intent.amount_capturable_updated",
      data: { object: pi },
    });

    // generateTestHeaderString produces a valid Stripe-Signature the webhook handler
    // accepts without needing a real Stripe delivery. (NFR-2)
    const sig = this.config.stripe.webhooks.generateTestHeaderString({
      payload,
      secret: this.config.stripeWebhookSecret,
    });

    await fetch(`${this.config.apiUrl}/webhooks/stripe`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": sig },
      body: payload,
    });
  }
}
