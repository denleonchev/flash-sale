"use server";
import { apiFetch } from "@/lib/api";
import { getSession } from "@/lib/session";
import { mintAdminTicket } from "@/lib/admin-ticket";
import { FraudFlagsSchema, FraudFlagSchema } from "@/lib/schemas/fraud-flag.schema";
import type { FraudFlag } from "@flash-sale/shared";

async function assertAccess(): Promise<void> {
  const session = await getSession();
  if (!session?.isAdmin && !session?.hasRole("moderator")) {
    throw new Error("Forbidden");
  }
}

export async function listFraudFlagsAction(status?: string): Promise<FraudFlag[]> {
  await assertAccess();
  const url = status ? `/admin/fraud-flags?status=${status}` : "/admin/fraud-flags";
  try {
    const res = await apiFetch(url, {
      headers: { "X-Admin-Ticket": mintAdminTicket() },
    });
    if (!res.ok) return [];
    return FraudFlagsSchema.parse(await res.json());
  } catch {
    return [];
  }
}

export async function reviewFlagAction(id: string): Promise<{ error?: string }> {
  await assertAccess();
  try {
    const res = await apiFetch(`/admin/fraud-flags/${id}/review`, {
      method: "PATCH",
      headers: { "X-Admin-Ticket": mintAdminTicket() },
    });
    if (!res.ok) return { error: "Failed to mark as reviewed" };
    FraudFlagSchema.parse(await res.json());
    return {};
  } catch {
    return { error: "Network error" };
  }
}
