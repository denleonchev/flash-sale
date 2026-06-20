import type { RunConfig } from "../concurrency/config.js";
import type { BuyOutcome } from "../concurrency/buy-outcome.js";

export interface SequentialFireReport {
  readonly buyerIds: string[]; // accepted, in acceptance order
  readonly errors: number;
}

const SEQUENTIAL_GAP_MS = 100;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Fires K buys one at a time with a gap between them — establishes a clear acceptance order. */
export class SequentialSwarm {
  constructor(private readonly config: RunConfig) {}

  async fireSequentialBuys(saleId: string): Promise<SequentialFireReport> {
    const buyerIds: string[] = [];
    let errors = 0;
    const total = this.config.stock;

    for (let i = 1; i <= total; i++) {
      const buyerId = `ordering-buyer-${i}`;
      const outcome = await this.fireOneBuy(saleId, buyerId);
      if (outcome === "accepted") {
        buyerIds.push(buyerId);
      } else if (outcome === "error") {
        errors++;
      }
      if (i < total) await sleep(SEQUENTIAL_GAP_MS);
    }

    return { buyerIds, errors };
  }

  private async fireOneBuy(
    saleId: string,
    buyerId: string,
  ): Promise<BuyOutcome> {
    try {
      const res = await fetch(`${this.config.apiUrl}/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saleId, buyerId, quantity: this.config.quantity }),
      });
      return res.ok ? "accepted" : "rejected";
    } catch {
      return "error";
    }
  }
}
