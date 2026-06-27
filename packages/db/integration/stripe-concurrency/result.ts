import type { RunConfig } from "./config.js";
import type { SwarmReport } from "./stripe-buyer-swarm.js";
import type { OrderSnapshot, WaitTiming } from "./order-inspector.js";

export class ConcurrencyResult {
  readonly passed: boolean;

  constructor(
    private readonly config: RunConfig,
    private readonly swarm: SwarmReport,
    private readonly snapshot: OrderSnapshot,
    private readonly timing: WaitTiming,
  ) {
    // NFR-1: exactly K confirmed, no more — oversell check.
    this.passed =
      !timing.timedOut &&
      snapshot.confirmed === config.stock &&
      snapshot.confirmed + snapshot.soldOut + snapshot.failed === swarm.accepted.length;
  }

  print(): void {
    console.log(`\n--- Stripe Concurrency Result ---`);
    console.log(`Config:  K=${this.config.stock} stock, N=${this.config.buyers} buyers`);
    console.log(
      `Swarm:   accepted=${this.swarm.accepted.length} rejected=${this.swarm.rejected} errors=${this.swarm.errors}`,
    );
    console.log(
      `DB:      confirmed=${this.snapshot.confirmed} sold_out=${this.snapshot.soldOut} failed=${this.snapshot.failed} in_progress=${this.snapshot.inProgress}`,
    );
    console.log(`Time:    ${this.timing.waitMs}ms${this.timing.timedOut ? " (TIMED OUT)" : ""}`);
    console.log(`\n${this.passed ? "PASS" : "FAIL"}`);

    if (!this.passed) {
      if (this.timing.timedOut) console.log("  x settlement timed out");
      if (this.snapshot.confirmed !== this.config.stock)
        console.log(
          `  x confirmed=${this.snapshot.confirmed}, expected K=${this.config.stock} (oversell or undersell)`,
        );
      const settled = this.snapshot.confirmed + this.snapshot.soldOut + this.snapshot.failed;
      if (settled !== this.swarm.accepted.length)
        console.log(
          `  x settled=${settled}, expected=${this.swarm.accepted.length} (orders stuck)`,
        );
    }
  }
}
