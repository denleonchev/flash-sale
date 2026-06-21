import type { Sale } from "@flash-sale/shared";
import { z } from "zod";

/**
 * Runtime contract for the sale view (S-1.1). The server response is untrusted at
 * runtime (TS types are erased), so `getSale` parses it through this schema —
 * "parse, don't validate". Zod lives only on the web side; the api validates its own
 * inbound requests with class-validator (see memory: validation-split).
 *
 * `satisfies z.ZodType<Sale>` binds the schema to the shared interface: if the
 * contract changes, this stops compiling, so schema and type cannot drift.
 */
export const SaleSchema = z.object({
  id: z.string(),
  title: z.string(),
  state: z.enum(["upcoming", "live", "ended"]),
  remainingStock: z.number().int().nonnegative(),
  startsAt: z.string(),
  endsAt: z.string(),
  serverNow: z.string(),
}) satisfies z.ZodType<Sale>;
