"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth0 } from "@/lib/auth0";
import { setUserRole } from "@/lib/auth0-management";
import {
  buildDemoRoleCookie,
  buildDemoUser,
  isDemoUser,
  mintDemoSessionCookie,
} from "@/lib/demo-session";

export async function startDemoAction(): Promise<void> {
  const store = await cookies();
  const session = await mintDemoSessionCookie(buildDemoUser());
  const role = buildDemoRoleCookie("");
  store.set(session.name, session.value, session.options);
  store.set(role.name, role.value, role.options);
  redirect("/sales");
}

const VALID_ROLES = ["", "moderator", "admin"] as const;

export type SwitchableRole = (typeof VALID_ROLES)[number];

export type SwitchRoleResult = { error?: string };

export async function switchRoleAction(
  role: SwitchableRole,
  path: string,
): Promise<SwitchRoleResult> {
  const session = await auth0.getSession();
  if (!session) return { error: "Sign in required" };
  if (!VALID_ROLES.includes(role)) return { error: "Invalid role" };

  const sub = session.user.sub;

  if (!isDemoUser(sub)) {
    try {
      await setUserRole(sub, role);
    } catch {
      return { error: "Auth0 rejected the role change" };
    }
    // prompt=login re-runs the post-login Actions so the new role lands in the ID token.
    // redirect() throws, hence outside the try.
    redirect(`/auth/login?prompt=login&returnTo=${encodeURIComponent(path)}`);
  }

  // A demo user has no Auth0 record, so switching is just a cookie write.
  const cookie = buildDemoRoleCookie(role);
  (await cookies()).set(cookie.name, cookie.value, cookie.options);

  // "layout": the header and the demo bar live in the root layout, so revalidating the
  // page alone would leave them stale.
  revalidatePath("/", "layout");
  return {};
}
