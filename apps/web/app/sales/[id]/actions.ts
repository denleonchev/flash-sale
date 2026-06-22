"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";
import { getSession } from "@/lib/session";
import { encodeBuyerId } from "@/lib/buyer-id";
import { mintAdminTicket } from "@/lib/admin-ticket";

export type BuyState = {
  errorMessage?: string;
  idempotencyKey?: string;
};

/**
 * Places an order for the signed-in buyer (S-2.5, FR-6). Matches the
 * `useActionState` signature so callers can use `.bind(null, saleId)` directly
 * without a client-side wrapper. Identity comes from the Auth0 session
 * server-side — never from the client (NFR-9).
 */
export async function buyAction(saleId: string): Promise<BuyState> {
  const session = await getSession();
  if (!session) {
    return { errorMessage: "Sign in required" };
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
    return { errorMessage: "Network error" };
  }

  if (res.status === 409) {
    const body = (await res.json()) as { message: string };
    return { errorMessage: body.message };
  }
  if (!res.ok) {
    return { errorMessage: `Unexpected error (${res.status})` };
  }

  const body = (await res.json()) as { status: string; idempotencyKey: string };
  return { idempotencyKey: body.idempotencyKey };
}

export async function endSaleAction(saleId: string, _formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session?.isAdmin) {
    throw new Error("Forbidden");
  }
  const res = await apiFetch(`/sales/${saleId}/end`, {
    method: "POST",
    headers: { "X-Admin-Ticket": mintAdminTicket() },
  });
  if (!res.ok) throw new Error(`Failed to end sale (${res.status})`);
  revalidatePath(`/sales/${saleId}`);
}
