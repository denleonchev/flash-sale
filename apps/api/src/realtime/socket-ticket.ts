import { timingSafeEqual, createHmac } from "node:crypto";

/**
 * Verifies a short-lived HMAC-SHA256 socket ticket issued by the web BFF. Returns
 * the `buyerId` on success, `null` on invalid signature or expiry. `timingSafeEqual`
 * prevents timing-based forgery (NFR-9). Uses only `node:crypto` — no new deps.
 *
 * Ticket format: `${buyerId}.${expiresAt}.${sigBase64url}` (web: `lib/socket-ticket.ts`)
 * Shared secret: `SOCKET_TICKET_SECRET` env var (must be set in both web and api). (FR-18, NFR-8)
 */
export function getBuyerId(ticket: string): string | null {
  const secret = process.env.SOCKET_TICKET_SECRET;
  if (!secret) return null;

  const dotCount = [...ticket].filter((c) => c === ".").length;
  if (dotCount !== 2) return null;

  const lastDotPos = ticket.lastIndexOf(".");
  const secondLastDotPos = ticket.lastIndexOf(".", lastDotPos - 1);
  const buyerId = ticket.slice(0, secondLastDotPos);
  const expiresAtStr = ticket.slice(secondLastDotPos + 1, lastDotPos);
  const receivedSig = ticket.slice(lastDotPos + 1);

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
  if (!buyerId) return null;

  const computedSig = createHmac("sha256", secret)
    .update(`${buyerId}.${expiresAtStr}`)
    .digest("base64url");

  const receivedSigBuf = Buffer.from(receivedSig, "base64url");
  const computedSigBuf = Buffer.from(computedSig, "base64url");
  if (receivedSigBuf.length !== computedSigBuf.length) return null;

  if (!timingSafeEqual(receivedSigBuf, computedSigBuf)) return null;

  return buyerId;
}
