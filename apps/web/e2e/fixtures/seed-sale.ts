import type { CreateSale, Sale } from "@flash-sale/shared";
import { apiFetch } from "@/lib/api";
import { mintAdminTicket } from "@/lib/admin-ticket";

export async function seedLiveSale(stockTotal: number): Promise<Sale> {
  const now = Date.now();
  const body: CreateSale = {
    title: `E2E buyer purchase flow ${new Date(now).toISOString()}`,
    stockTotal,
    priceCents: 1000,
    startsAt: new Date(now - 60_000).toISOString(),
    endsAt: new Date(now + 3_600_000).toISOString(),
  };

  const res = await apiFetch("/sales", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Ticket": mintAdminTicket() },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`seedLiveSale failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as Sale;
}
