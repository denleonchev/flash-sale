import { NextResponse } from "next/server";
import { clientErrorReportSchema } from "@/lib/schemas/client-error-report.schema";
import { logger } from "@/lib/logger/logger.server";

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = clientErrorReportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  logger.error({ source: "client", ...parsed.data }, parsed.data.message);
  return NextResponse.json({ ok: true });
}
