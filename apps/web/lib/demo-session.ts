import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { generateSessionCookie } from "@auth0/nextjs-auth0/testing";
import { ROLES_CLAIM } from "@/lib/admin-ticket";

/**
 * Demo access without registration: `generateSessionCookie` is the SDK's own helper, so
 * the minted cookie is the one a real Auth0 login would write — no round-trip needed.
 *
 * The role is a separate cookie on purpose: the Auth0 middleware re-issues `__session`
 * on every response from the session that request carried, so a role written into it
 * loses the race against that write and against requests still in flight.
 *
 * Identities are per visitor: the api blocks a second order for the same (buyer, sale),
 * so one shared demo buyer would break the two-windows-one-sale demo.
 */
const DEMO_USER_PREFIX = "demo|";

// The SDK's own cookie name (its default) — this is its session, not ours.
const SESSION_COOKIE_NAME = "__session";

// generateSessionCookie encrypts with a fixed 1 h expiry; the cookie must not outlive it.
const SESSION_TTL_SECONDS = 60 * 60;

// buyerId = base64url(sub), capped at 64 chars by the api (CreateOrderDto).
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

export function isDemoUser(sub: string): boolean {
  return sub.startsWith(DEMO_USER_PREFIX);
}

export function buildDemoUser(): DemoUser {
  const id = randomBytes(DEMO_ID_BYTES).toString("hex");
  return {
    sub: `${DEMO_USER_PREFIX}${id}`,
    email: `demo-${id}@flash-sale.local`,
    name: `Demo buyer ${id}`,
  };
}

export async function mintDemoSessionCookie(user: DemoUser): Promise<DemoSessionCookie> {
  const secret = process.env.AUTH0_SECRET;
  if (!secret) throw new Error("AUTH0_SECRET is not set");

  const now = Math.floor(Date.now() / 1000);
  const value = await generateSessionCookie(
    {
      user: { ...user, email_verified: true, [ROLES_CLAIM]: [] },
      // Placeholder: the api authenticates via BFF tickets, so no real token is needed.
      tokenSet: { accessToken: "demo", expiresAt: now + SESSION_TTL_SECONDS },
      internal: { sid: `demo-${user.sub}`, createdAt: now },
    },
    { secret },
  );

  return { name: SESSION_COOKIE_NAME, value, options: buildCookieOptions(SESSION_TTL_SECONDS) };
}

function buildCookieOptions(maxAge: number): DemoSessionCookie["options"] {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.APP_BASE_URL?.startsWith("https://") ?? false,
    maxAge,
  };
}

const ROLE_COOKIE_NAME = "demo_role";

// Not a trust boundary — any visitor may pick any role; the signature only stops hand-editing.
function signDemoRole(role: string): string {
  const secret = process.env.AUTH0_SECRET;
  if (!secret) throw new Error("AUTH0_SECRET is not set");
  return createHmac("sha256", secret).update(`demo-role.${role}`).digest("base64url");
}

export function buildDemoRoleCookie(role: string): DemoSessionCookie {
  return {
    name: ROLE_COOKIE_NAME,
    value: `${role}.${signDemoRole(role)}`,
    options: buildCookieOptions(SESSION_TTL_SECONDS),
  };
}

export async function readDemoRole(): Promise<string> {
  const raw = (await cookies()).get(ROLE_COOKIE_NAME)?.value;
  if (!raw) return "";
  const dot = raw.indexOf(".");
  if (dot === -1) return "";

  const role = raw.slice(0, dot);
  const received = Buffer.from(raw.slice(dot + 1), "base64url");
  const expected = Buffer.from(signDemoRole(role), "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return "";

  return role;
}

export function buildExpiredDemoCookies(): Array<Pick<DemoSessionCookie, "name" | "options">> {
  return [SESSION_COOKIE_NAME, ROLE_COOKIE_NAME].map((name) => ({
    name,
    options: buildCookieOptions(0),
  }));
}
