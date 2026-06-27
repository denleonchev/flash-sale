import type { RunConfig } from "./config.js";

// pm_card_visa: reusable Stripe test-mode fixture — no 3DS, always authorises.
const TEST_PAYMENT_METHOD = "pm_card_visa";

export interface BuyOutcome {
  clientSecret: string;
}

export interface SwarmReport {
  accepted: BuyOutcome[];
  rejected: number;
  errors: number;
}

export class StripeBuyerSwarm {
  constructor(private readonly config: RunConfig) {}

  async fireConcurrentBuys(saleId: string): Promise<SwarmReport> {
    // Build all promises first, then await together → maximal simultaneity.
    const raw = await Promise.all(
      Array.from({ length: this.config.buyers }, (_, i) =>
        this.fireOneBuy(saleId, `buyer-${i + 1}`),
      ),
    );

    const accepted = raw.filter((r): r is BuyOutcome => r !== null && r !== false);
    const rejected = raw.filter((r) => r === null).length;
    const errors = raw.filter((r) => r === false).length;

    return { accepted, rejected, errors };
  }

  private async fireOneBuy(saleId: string, buyerId: string): Promise<BuyOutcome | null | false> {
    // null = rejected (409), false = connection error
    try {
      const res = await fetch(`${this.config.apiUrl}/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saleId,
          buyerId,
          email: `${buyerId}@test.example`,
          quantity: 1,
          paymentMethodId: TEST_PAYMENT_METHOD,
        }),
      });

      if (res.ok) {
        const body = (await res.json()) as { clientSecret?: string };
        // No clientSecret means duplicate request returned the existing order — skip.
        if (!body.clientSecret) return null;
        return { clientSecret: body.clientSecret };
      }
      return null; // 409 sold-out / not-live
    } catch {
      return false; // connection failure
    }
  }
}
