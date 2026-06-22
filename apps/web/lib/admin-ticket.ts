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
const ROLES_CLAIM = "https://flash-sale/roles" as const;

type Session = { tokenSet?: { idToken?: string }; user: Record<string, unknown> };

function decodeRoles(session: Session): string[] {
  const idToken = session.tokenSet?.idToken;
  if (idToken) {
    try {
      const payload = JSON.parse(
        Buffer.from(idToken.split(".")[1], "base64url").toString(),
      ) as Record<string, unknown>;
      return (payload[ROLES_CLAIM] as string[]) ?? [];
    } catch { /* fall through */ }
  }
  return (session.user[ROLES_CLAIM] as string[]) ?? [];
}

export function hasRole(session: Session, role: string): boolean {
  return decodeRoles(session).includes(role);
}

export const isAdminSession = (session: Session) => hasRole(session, "admin");
