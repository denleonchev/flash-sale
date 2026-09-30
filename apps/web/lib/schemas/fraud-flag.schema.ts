import { FRAUD_FLAG_STATUSES, RISK_LEVELS, type FraudFlag } from "@flash-sale/shared";
import { z } from "zod";

export const FraudFlagSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  buyerId: z.string(),
  buyerEmail: z.string().nullable(),
  buyerName: z.string().nullable(),
  saleId: z.string(),
  saleTitle: z.string(),
  risk: z.enum(Object.values(RISK_LEVELS)),
  reason: z.string(),
  pattern: z.string(),
  status: z.enum(Object.values(FRAUD_FLAG_STATUSES)),
  createdAt: z.string(),
  reviewedAt: z.string().nullable(),
}) satisfies z.ZodType<FraudFlag>;

export const FraudFlagsSchema = z.array(FraudFlagSchema);
