import { NextResponse } from "next/server";
import { buildExpiredDemoCookies } from "@/lib/demo-session";

export async function GET(req: Request): Promise<NextResponse> {
  const res = NextResponse.redirect(new URL("/", req.url));
  for (const { name, options } of buildExpiredDemoCookies()) {
    res.cookies.set(name, "", options);
  }
  return res;
}
