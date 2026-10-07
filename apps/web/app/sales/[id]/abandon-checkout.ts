import { apiFetch } from "@/lib/api";

/**
 * FR-29: requesting the sale page means an unauthorized payment was given up. The api
 * only enqueues the check, so this adds no provider latency to the page.
 * Never throws — the page must render even if the call fails; the scheduled
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
