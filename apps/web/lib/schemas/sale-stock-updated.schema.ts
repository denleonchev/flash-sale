import type { SaleStockUpdatedPayload } from "@flash-sale/shared";
import { z } from "zod";

/**
 * Runtime contract for the `sale:stock:updated` socket event (S-3.1, FR-17). The socket
 * payload is untrusted at runtime like any wire data, so the client parses it before
 * using the number — "parse, don't validate". `satisfies z.ZodType<SaleStockUpdatedPayload>`
 * keeps the schema bound to the shared type. (see memory: validation-split)
 */
export const SaleStockUpdatedSchema = z.object({
  saleId: z.string(),
  remainingStock: z.number().int().nonnegative(),
}) satisfies z.ZodType<SaleStockUpdatedPayload>;
