import { cache } from "react";
import type { Sale } from "@flash-sale/shared";
import { apiFetch } from "@/lib/api";
import { SaleSchema } from "@/lib/schemas/sale.schema";

/** Fetches one sale from the Nest api (server-only). Returns null on 404. */
export const getSale = cache(async (id: string): Promise<Sale | null> => {
  const res = await apiFetch(`/sales/${id}`);
  if (!res.ok) return null;
  return SaleSchema.parse(await res.json());
});
