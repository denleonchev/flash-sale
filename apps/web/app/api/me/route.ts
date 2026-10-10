import { NextResponse } from "next/server";
import { buildSessionSummary, getSession } from "@/lib/session";

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  return NextResponse.json(
    { session: session ? buildSessionSummary(session) : null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
