import { NextResponse } from "next/server";
import { buildDemoSessionClearing } from "@/lib/demo-session";

export async function GET(req: Request): Promise<NextResponse> {
  const res = NextResponse.redirect(new URL("/", req.url));
  const { name, options } = buildDemoSessionClearing();
  res.cookies.set(name, "", options);
  return res;
}
