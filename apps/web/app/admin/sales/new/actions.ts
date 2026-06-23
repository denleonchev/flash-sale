"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";
import { getSession } from "@/lib/session";
import { mintAdminTicket } from "@/lib/admin-ticket";
import { SaleSchema } from "@/lib/schemas/sale.schema";
import type { CreateSale } from "@flash-sale/shared";

export type CreateSaleState = { errorMessage?: string };

export async function createSaleAction(
  _prev: CreateSaleState,
  formData: FormData,
): Promise<CreateSaleState> {
  const session = await getSession();
  if (!session?.isAdmin) {
    return { errorMessage: "Forbidden" };
  }

  // datetime-local gives "YYYY-MM-DDTHH:mm" (local time) — convert to ISO UTC.
  const rawDescription = formData.get("description");
  const body: CreateSale = {
    title: formData.get("title") as string,
    ...(rawDescription ? { description: rawDescription as string } : {}),
    stockTotal: Number(formData.get("stockTotal")),
    // price is entered in dollars; Stripe and DB work in cents
    priceCents: Math.round(parseFloat(formData.get("price") as string) * 100),
    startsAt: new Date(formData.get("startsAt") as string).toISOString(),
    endsAt: new Date(formData.get("endsAt") as string).toISOString(),
  };

  let res: Response;
  try {
    res = await apiFetch("/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Ticket": mintAdminTicket() },
      body: JSON.stringify(body),
    });
  } catch {
    return { errorMessage: "Network error" };
  }

  if (!res.ok) {
    const body = (await res.json()) as { message: string | string[] };
    const msg = Array.isArray(body.message) ? body.message.join("; ") : body.message;
    return { errorMessage: msg };
  }

  const sale = SaleSchema.parse(await res.json());
  revalidatePath("/sales");
  redirect(`/sales/${sale.id}`);
}
