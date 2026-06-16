"use server";

import { apiFetch } from "@/lib/api";
import { auth0 } from "@/lib/auth0";
import { encodeBuyerId } from "@/lib/buyer-id";

type BuyResult =
  | { ok: true; status: string; idempotencyKey: string }
  | { ok: false; message: string };

/**
 * Places an order for the signed-in buyer (S-2.5, FR-6). Identity comes from the
 * Auth0 session server-side — never from the client (NFR-9). Signed-out → rejected
 * here, before any api call, so no order is created.
 */
export async function buyAction(saleId: string): Promise<BuyResult> {
  const session = await auth0.getSession();
  if (!session) {
    return { ok: false, message: "Sign in required" };
  }
  const buyerId = encodeBuyerId(session.user.sub);

  let res: Response;
  try {
    res = await apiFetch("/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saleId, buyerId, quantity: 1 }),
    });
  } catch {
    return { ok: false, message: "Network error" };
  }

  if (res.status === 409) {
    const body = (await res.json()) as { message: string };
    return { ok: false, message: body.message };
  }
  if (!res.ok) {
    return { ok: false, message: `Unexpected error (${res.status})` };
  }

  const body = (await res.json()) as { status: string; idempotencyKey: string };
  return { ok: true, ...body };
}
