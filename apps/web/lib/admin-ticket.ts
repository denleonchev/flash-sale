import { createHmac } from "node:crypto";

/**
 * Issues a short-lived HMAC-SHA256 admin ticket. Sent in the `X-Admin-Ticket`
 * header so the api can verify admin identity without an Auth0 round-trip
 * (BFF pattern preserved). (NFR-7)
 *
 * Format: `${expMs}.${sigBase64url}` — verified by api's AdminGuard.
 * Shared secret: `ADMIN_TICKET_SECRET` env var — must be set in both web and api. (NFR-8)
 */
export function mintAdminTicket(): string {
  const secret = process.env.ADMIN_TICKET_SECRET;
  if (!secret) throw new Error("ADMIN_TICKET_SECRET is not set");
  const exp = Date.now() + 30_000; // 30 s TTL
  const sig = createHmac("sha256", secret).update(String(exp)).digest("base64url");
  return `${exp}.${sig}`;
}

// @auth0/nextjs-auth0 v4 builds session.user from /userinfo which omits custom
// namespace claims. They are only in the ID token — decode it directly.
export function isAdminSession(session: {
  tokenSet?: { idToken?: string };
  user: Record<string, unknown>;
}): boolean {
  const idToken = session.tokenSet?.idToken;
  if (idToken) {
    try {
      const payload = JSON.parse(
        Buffer.from(idToken.split(".")[1], "base64url").toString(),
      ) as Record<string, unknown>;
      const roles = (payload["https://flash-sale/roles"] as string[]) ?? [];
      return roles.includes("admin");
    } catch {
      // fall through to user object
    }
  }
  const roles = (session.user["https://flash-sale/roles"] as string[]) ?? [];
  return roles.includes("admin");
}
