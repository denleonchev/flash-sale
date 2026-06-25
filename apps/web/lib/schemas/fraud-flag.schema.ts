import type { FraudFlagDto } from "@flash-sale/shared";
import { z } from "zod";

export const FraudFlagSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  buyerId: z.string(),
  saleId: z.string(),
  risk: z.enum(["low", "medium", "high"]),
  reason: z.string(),
  pattern: z.string(),
  status: z.enum(["open", "reviewed"]),
  createdAt: z.string(),
  reviewedAt: z.string().nullable(),
}) satisfies z.ZodType<FraudFlagDto>;

export const FraudFlagsSchema = z.array(FraudFlagSchema);
