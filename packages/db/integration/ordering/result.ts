/** Verdict for the ordering test runner: confirmed buyer order must match acceptance order (FR-10). */
export class OrderingResult {
  constructor(
    private readonly acceptedBuyerIds: string[],
    private readonly confirmedBuyerIds: string[],
  ) {}

  get passed(): boolean {
    return (
      this.acceptedBuyerIds.length === this.confirmedBuyerIds.length &&
      this.acceptedBuyerIds.every((id, i) => id === this.confirmedBuyerIds[i])
    );
  }

  print(): void {
    console.log("\n──────── ordering result ────────");
    console.log(`acceptance order  : ${this.acceptedBuyerIds.join(", ")}`);
    console.log(`confirmation order: ${this.confirmedBuyerIds.join(", ")}`);
    console.log("──────────────────────────────────");
    console.log(
      this.passed
        ? "✅ PASS — orders confirmed in acceptance order"
        : "❌ FAIL — confirmation order does not match acceptance order",
    );
  }
}
