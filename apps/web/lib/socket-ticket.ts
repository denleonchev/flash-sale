import { createHmac } from "node:crypto";

/**
 * Issues a short-lived HMAC-SHA256 socket ticket for an authenticated buyer.
 * The ticket is passed in the Socket.IO handshake `auth.ticket` field so the api
 * can verify identity without an OIDC round-trip (BFF pattern preserved). (FR-18)
 *
 * Server-only: uses `node:crypto` and reads `SOCKET_TICKET_SECRET` from env. (NFR-8)
 * Ticket format: `${buyerId}.${expMs}.${sigBase64url}` — verified by api's `verifySocketTicket`.
 */
export function mintSocketTicket(buyerId: string): string {
  const secret = process.env.SOCKET_TICKET_SECRET;
  if (!secret) throw new Error("SOCKET_TICKET_SECRET is not set");

  const exp = Date.now() + 60_000; // 60 s TTL — refreshed on every (re)connect
  const sig = createHmac("sha256", secret).update(`${buyerId}.${exp}`).digest("base64url");

  return `${buyerId}.${exp}.${sig}`;
}
