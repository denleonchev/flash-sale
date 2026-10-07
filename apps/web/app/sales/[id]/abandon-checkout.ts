import { apiFetch } from "@/lib/api";

/**
 * FR-29: asks the api to reconcile the buyer's unfinished order now. The api only
 * enqueues the check, so no provider latency is added here.
 * Never throws — a failed call must not block the buy form; the scheduled
 * reconciliation (FR-28) still closes the order later.
 */
export async function abandonCheckout(saleId: string, buyerId: string): Promise<void> {
  try {
    const res = await apiFetch("/orders/abandon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saleId, buyerId }),
    });
    if (!res.ok) console.error(`abandonCheckout: api responded ${res.status}`);
  } catch (err) {
    console.error("abandonCheckout: request failed", err);
  }
}
