import type { SaleDto } from "@flash-sale/shared";
import { SaleSchema } from "./sale.schema";

/**
 * Fetches one sale from the Nest api (server-only — imported solely by the server component).
 * the same SaleSchema.parse call remains — only the data source changes.
 * `cache: "no-store"` because remainingStock is volatile (FR-2 / NFR-2).
 */
const API_INTERNAL_URL =
  process.env["API_INTERNAL_URL"] ?? "http://localhost:3001";

export async function getSale(id: string): Promise<SaleDto | null> {
  const res = await fetch(`${API_INTERNAL_URL}/sales/${id}`, {
    cache: "no-store",
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    throw new Error(`Failed to fetch sale ${id}: ${res.status}`);
  }

  return SaleSchema.parse(await res.json());
}
