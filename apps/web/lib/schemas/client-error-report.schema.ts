import { z } from "zod";

export const CLIENT_ERROR_KINDS = [
  "render-error",
  "global-error",
  "window-error",
  "unhandled-rejection",
] as const;

export const clientErrorReportSchema = z.object({
  kind: z.enum(CLIENT_ERROR_KINDS),
  message: z.string().max(2000),
  stack: z.string().max(8000).optional(),
  digest: z.string().max(200).optional(),
  path: z.string().max(500),
});

export type ClientErrorReport = z.infer<typeof clientErrorReportSchema>;
