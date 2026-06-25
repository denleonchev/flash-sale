import type { FraudFlag } from "@flash-sale/shared";
import { z } from "zod";

export const FraudFlagSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  buyerId: z.string(),
  buyerEmail: z.string().nullable(),
  buyerName: z.string().nullable(),
  saleId: z.string(),
  risk: z.enum(["low", "medium", "high"]),
  reason: z.string(),
  pattern: z.string(),
  status: z.enum(["open", "reviewed"]),
  createdAt: z.string(),
  reviewedAt: z.string().nullable(),
}) satisfies z.ZodType<FraudFlag>;

export const FraudFlagsSchema = z.array(FraudFlagSchema);
