import type { Sale } from "@flash-sale/shared";
import { apiFetch } from "@/lib/api";
import { SaleSchema } from "@/lib/schemas/sale.schema";

/** Fetches one sale from the Nest api (server-only). Returns null on 404. */
export async function getSale(id: string): Promise<Sale | null> {
  const res = await apiFetch(`/sales/${id}`);
  if (!res.ok) return null;
  return SaleSchema.parse(await res.json());
}
