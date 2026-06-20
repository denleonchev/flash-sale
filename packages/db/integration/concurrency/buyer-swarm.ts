import type { RunConfig } from "./config.js";
import type { BuyOutcome } from "./buy-outcome.js";

export interface SwarmReport {
  readonly accepted: number;
  readonly rejected: number;
  readonly errors: number;
}

/** Fires N buys at one sale as simultaneously as possible — this is the race. */
export class BuyerSwarm {
  constructor(private readonly config: RunConfig) {}

  async fireConcurrentBuys(saleId: string): Promise<SwarmReport> {
    // Build all promises first, then await together → maximal simultaneity.
    const outcomes = await Promise.all(
      Array.from({ length: this.config.buyers }, (_, i) =>
        this.fireOneBuy(saleId, `buyer-${i + 1}`),
      ),
    );
    return {
      accepted: outcomes.filter((o) => o === "accepted").length,
      rejected: outcomes.filter((o) => o === "rejected").length,
      errors: outcomes.filter((o) => o === "error").length,
    };
  }

  private async fireOneBuy(saleId: string, buyerId: string): Promise<BuyOutcome> {
    try {
      const res = await fetch(`${this.config.apiUrl}/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saleId, buyerId, quantity: this.config.quantity }),
      });
      return res.ok ? "accepted" : "rejected"; // 409 sold-out/not-live → expected non-accept
    } catch {
      return "error"; // connection failure — api likely not running
    }
  }
}
