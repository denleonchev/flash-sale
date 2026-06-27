import { Controller, Headers, Post, RawBodyRequest, Req } from "@nestjs/common";
import { StripeWebhookService } from "./stripe-webhook.service.js";

/** Receives Stripe webhook events. Raw body is required for signature verification. */
@Controller("webhooks/stripe")
export class StripeWebhookController {
  constructor(private readonly service: StripeWebhookService) {}

  @Post()
  handleWebhook(
    @Req() req: RawBodyRequest<{ rawBody?: Buffer }>,
    @Headers("stripe-signature") sig: string,
  ): Promise<void> {
    return this.service.handleEvent(req.rawBody!, sig);
  }
}
