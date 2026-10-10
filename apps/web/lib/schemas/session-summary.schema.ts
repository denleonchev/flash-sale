import { z } from "zod";

export const SESSION_ROLES = {
  BUYER: "",
  MODERATOR: "moderator",
  ADMIN: "admin",
} as const;

export type SessionRole = (typeof SESSION_ROLES)[keyof typeof SESSION_ROLES];

export const SessionSummarySchema = z.object({
  displayName: z.string(),
  role: z.enum(Object.values(SESSION_ROLES)),
  isDemo: z.boolean(),
});

export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const SessionSummaryResponseSchema = z.object({
  session: SessionSummarySchema.nullable(),
});
