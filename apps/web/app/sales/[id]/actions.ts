"use server";

import { apiFetch } from "@/lib/api";

type BuyResult =
  | { ok: true; status: string; idempotencyKey: string }
  | { ok: false; message: string };

export async function buyAction(saleId: string, buyerId: string): Promise<BuyResult> {
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
