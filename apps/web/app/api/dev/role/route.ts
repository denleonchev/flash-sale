import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { setUserRole } from "@/lib/auth0-management";

const VALID_ROLES = new Set(["", "moderator", "admin"]);

export async function POST(req: Request): Promise<NextResponse> {
  const session = await auth0.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { role?: unknown };
  const role = body.role;
  if (typeof role !== "string" || !VALID_ROLES.has(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  await setUserRole(session.user.sub as string, role);
  return NextResponse.json({ ok: true });
}
