"use server";
import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";
import { getSession } from "@/lib/session";
import { mintAdminTicket } from "@/lib/admin-ticket";
import { FraudFlagsSchema, FraudFlagSchema } from "@/lib/schemas/fraud-flag.schema";
import type { FraudFlag, FraudFlagStatus } from "@flash-sale/shared";

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

export async function setFlagStatusAction(
  id: string,
  status: FraudFlagStatus,
): Promise<{ error?: string }> {
  await assertAccess();
  try {
    const res = await apiFetch(`/admin/fraud-flags/${id}/status`, {
      method: "PATCH",
      headers: { "X-Admin-Ticket": mintAdminTicket(), "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return { error: "Failed to update status" };
    FraudFlagSchema.parse(await res.json());
    revalidatePath("/admin/fraud-flags");
    return {};
  } catch {
    return { error: "Network error" };
  }
}
