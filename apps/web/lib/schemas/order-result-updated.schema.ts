import type { OrderResultUpdatedPayload } from "@flash-sale/shared";
import { ORDER_STATUS_VALUES } from "@flash-sale/shared";
import { z } from "zod";

/**
 * Runtime contract for the `order:result:updated` socket event (S-3.2, FR-18).
 * `satisfies z.ZodType<OrderResultUpdatedPayload>` keeps the schema bound to the
 * shared type. `z.enum(ORDER_STATUS_VALUES)` reuses the canonical tuple from shared.
 * (see memory: validation-split, constants-over-literals)
 */
export const OrderResultUpdatedSchema = z.object({
  saleId: z.string(),
  status: z.enum(ORDER_STATUS_VALUES),
  orderId: z.string(),
}) satisfies z.ZodType<OrderResultUpdatedPayload>;
