import { deriveSaleState, type Sale } from "@flash-sale/shared";
import type { Sale as SaleModel } from "@flash-sale/db/client";

export function toSale(sale: SaleModel, remainingStock: number, now: Date): Sale {
  return {
    id: sale.id,
    title: sale.title,
    state: deriveSaleState({ startsAt: sale.startsAt, endsAt: sale.endsAt, remainingStock }, now),
    remainingStock,
    startsAt: sale.startsAt.toISOString(),
    endsAt: sale.endsAt.toISOString(),
    serverNow: now.toISOString(),
    priceCents: sale.priceCents,
  };
}
