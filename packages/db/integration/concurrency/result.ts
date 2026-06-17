import type { HarnessConfig } from "./config.js";
import type { FireReport } from "./buyer-swarm.js";
import type { OrderSnapshot, DrainTiming } from "./order-inspector.js";

/** The verdict and its human-readable report. */
export class HarnessResult {
  constructor(
    private readonly config: HarnessConfig,
    private readonly fire: FireReport,
    private readonly snapshot: OrderSnapshot,
    private readonly timing: DrainTiming,
  ) {}

  /** PASS ⟺ exactly K confirmed and no buyer confirmed twice. */
  get passed(): boolean {
    return (
      this.snapshot.confirmed === this.config.stock &&
      this.snapshot.duplicateBuyers === 0
    );
  }

  print(): void {
    console.log("\n──────── result ────────");
    console.log(`stock (K)        : ${this.config.stock}`);
    console.log(`buyers (N)       : ${this.config.buyers}`);
    console.log(`http accepted    : ${this.fire.accepted}`);
    console.log(`http rejected    : ${this.fire.rejected}`);
    if (this.fire.errors > 0) {
      console.log(`http errors      : ${this.fire.errors}  (api running?)`);
    }
    console.log(`confirmed (DB)   : ${this.snapshot.confirmed}`);
    console.log(`duplicate buyers : ${this.snapshot.duplicateBuyers}`);
    console.log(`first confirm    : ${this.formatMs(this.timing.firstConfirmMs)}`);
    console.log(`drained          : ${this.formatMs(this.timing.drainMs)}`);
    console.log("──────────────────────── (timing ±250ms poll resolution)");
    console.log(
      this.passed
        ? "✅ PASS — no oversell"
        : "❌ FAIL — oversell or duplicate detected",
    );
  }

  private formatMs(ms: number | null): string {
    return ms === null ? "— (not reached)" : `${ms} ms`;
  }
}
