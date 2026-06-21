"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";
import { SaleSchema } from "@/lib/schemas/sale.schema";
import type { CreateSale } from "@flash-sale/shared";

export type CreateSaleState = { errorMessage?: string };

export async function createSaleAction(
  _prev: CreateSaleState,
  formData: FormData,
): Promise<CreateSaleState> {
  // TODO NFR-7: check admin role from Auth0 session before proceeding.
  // datetime-local gives "YYYY-MM-DDTHH:mm" (local time) — convert to ISO UTC.
  const body: CreateSale = {
    title: formData.get("title") as string,
    stockTotal: Number(formData.get("stockTotal")),
    startsAt: new Date(formData.get("startsAt") as string).toISOString(),
    endsAt: new Date(formData.get("endsAt") as string).toISOString(),
  };

  let res: Response;
  try {
    res = await apiFetch("/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
