import { NextResponse } from "next/server";
import { buildExpiredDemoCookies } from "@/lib/demo-session";

export async function GET(req: Request): Promise<NextResponse> {
  // Behind Caddy the request URL carries the container host (HOSTNAME=0.0.0.0), so the
  // redirect target comes from APP_BASE_URL when it is set.
  const base = process.env.APP_BASE_URL ?? req.url;
  const res = NextResponse.redirect(new URL("/", base));
  for (const { name, options } of buildExpiredDemoCookies()) {
    res.cookies.set(name, "", options);
  }
  return res;
}
