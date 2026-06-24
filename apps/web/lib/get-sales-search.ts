import { z } from "zod";
import type { Sale } from "@flash-sale/shared";
import { apiFetch } from "@/lib/api";
import { SaleSchema } from "@/lib/schemas/sale.schema";

const SalesSchema = z.array(SaleSchema) satisfies z.ZodType<Sale[]>;

/** Server-only. Fetches sales ranked by semantic similarity to `query` (FR-26). */
export async function getSalesSearch(query: string): Promise<Sale[]> {
  const res = await apiFetch(`/sales/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return SalesSchema.parse(await res.json());
}
