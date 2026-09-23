"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { buildDemoUser, mintDemoSessionCookie } from "@/lib/demo-session";

export async function startDemoAction(): Promise<void> {
  const { name, value, options } = await mintDemoSessionCookie(buildDemoUser(), []);
  (await cookies()).set(name, value, options);
  redirect("/sales");
}
