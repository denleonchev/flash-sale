import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { encodeBuyerId } from "@/lib/buyer-id";
import { mintSocketTicket } from "@/lib/socket-ticket";

/**
 * `GET /api/socket-ticket` — issues a short-lived HMAC ticket for the signed-in
 * buyer. The browser fetches this on every Socket.IO (re)connect and passes the
 * ticket in `handshake.auth.ticket`; the api verifies it without JWKS/OIDC (BFF
 * pattern preserved). Returns `{ ticket: null }` for anonymous visitors. (FR-18)
 */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session?.user.sub) {
    return NextResponse.json({ ticket: null });
  }
  const buyerId = encodeBuyerId(session.user.sub);
  return NextResponse.json({ ticket: mintSocketTicket(buyerId) });
}
