import "server-only";
import { randomBytes } from "node:crypto";
import { generateSessionCookie } from "@auth0/nextjs-auth0/testing";
import { ROLES_CLAIM } from "@/lib/admin-ticket";

/**
 * Demo access without registration: mints the same encrypted session cookie the
 * Auth0 SDK writes after a real login, so `auth0.getSession()` and every guard
 * read it unchanged. `generateSessionCookie` is the SDK's own helper (it encrypts
 * with AUTH0_SECRET), which is why no Auth0 round-trip is needed.
 *
 * Demo identities are per visitor, not one shared account: the api blocks a second
 * order for the same (buyer, sale) pair, so a shared buyer would break the
 * two-windows-one-sale demo.
 */
export const DEMO_SUB_PREFIX = "demo|";

// Must match @auth0/nextjs-auth0's session cookie name (its default) — we are writing
// that SDK's cookie, not our own.
const SESSION_COOKIE_NAME = "__session";

// generateSessionCookie encrypts with a fixed 1 h expiry; the cookie must not outlive it.
const SESSION_TTL_SECONDS = 60 * 60;

// buyerId = base64url(sub) and the api caps it at 64 chars (CreateOrderDto), so the sub
// must stay short.
const DEMO_ID_BYTES = 3;

export type DemoUser = {
  sub: string;
  email: string;
  name: string;
};

export type DemoSessionCookie = {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    sameSite: "lax";
    path: "/";
    secure: boolean;
    maxAge: number;
  };
};

export function isDemoSub(sub: string): boolean {
  return sub.startsWith(DEMO_SUB_PREFIX);
}

export function buildDemoUser(): DemoUser {
  const id = randomBytes(DEMO_ID_BYTES).toString("hex");
  return {
    sub: `${DEMO_SUB_PREFIX}${id}`,
    email: `demo-${id}@flash-sale.local`,
    // The suffix keeps two demo visitors apart in the header and in the orders table.
    name: `Demo buyer ${id}`,
  };
}

export async function mintDemoSessionCookie(
  user: DemoUser,
  roles: readonly string[],
): Promise<DemoSessionCookie> {
  const secret = process.env.AUTH0_SECRET;
  if (!secret) throw new Error("AUTH0_SECRET is not set");

  const now = Math.floor(Date.now() / 1000);
  const value = await generateSessionCookie(
    {
      user: { ...user, email_verified: true, [ROLES_CLAIM]: roles },
      // No real tokens exist for a demo user; nothing reads them — roles come from the
      // user object (see decodeRoles) and the api authenticates via BFF tickets, not JWTs.
      tokenSet: { accessToken: "demo", expiresAt: now + SESSION_TTL_SECONDS },
      internal: { sid: `demo-${user.sub}`, createdAt: now },
    },
    { secret },
  );

  return {
    name: SESSION_COOKIE_NAME,
    value,
    options: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.APP_BASE_URL?.startsWith("https://") ?? false,
      maxAge: SESSION_TTL_SECONDS,
    },
  };
}

export function buildDemoSessionClearing(): Pick<DemoSessionCookie, "name" | "options"> {
  return {
    name: SESSION_COOKIE_NAME,
    options: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.APP_BASE_URL?.startsWith("https://") ?? false,
      maxAge: 0,
    },
  };
}
