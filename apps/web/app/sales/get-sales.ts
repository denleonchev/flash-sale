import { z } from "zod";
import type { Sale } from "@flash-sale/shared";
import { apiFetch } from "@/lib/api";
import { SaleSchema } from "@/lib/schemas/sale.schema";

const SalesSchema = z.array(SaleSchema) satisfies z.ZodType<Sale[]>;

/** Fetches all sales from the Nest api (server-only). */
export async function getSales(): Promise<Sale[]> {
  const res = await apiFetch("/sales");
  if (!res.ok) throw new Error(`Failed to fetch sales: ${res.status}`);
  return SalesSchema.parse(await res.json());
}
