import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { setUserRole } from "@/lib/auth0-management";
import { isDemoSub, mintDemoSessionCookie, type DemoUser } from "@/lib/demo-session";

const VALID_ROLES = new Set(["", "moderator", "admin"]);

export async function POST(req: Request): Promise<NextResponse> {
  const session = await auth0.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { role?: unknown };
  const role = body.role;
  if (typeof role !== "string" || !VALID_ROLES.has(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const sub = session.user.sub as string;

  // A demo user has no Auth0 record — the role lives in the session cookie, so the new
  // role is applied by re-issuing it. No Management API call, no re-login round-trip.
  if (isDemoSub(sub)) {
    const user: DemoUser = {
      sub,
      email: session.user.email as string,
      name: session.user.name as string,
    };
    const cookie = await mintDemoSessionCookie(user, role === "" ? [] : [role]);
    const res = NextResponse.json({ ok: true, demo: true });
    res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
  }

  await setUserRole(sub, role);
  return NextResponse.json({ ok: true });
}
