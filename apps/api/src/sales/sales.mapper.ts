import { deriveSaleState, type SaleDto } from "@flash-sale/shared";
import type { Sale } from "@flash-sale/db/client";

/** Maps a DB Sale row + precomputed remainingStock to a SaleDto. */
export function toSaleDto(sale: Sale, remainingStock: number, now: Date): SaleDto {
  return {
    id: sale.id,
    title: sale.title,
    state: deriveSaleState({ startsAt: sale.startsAt, endsAt: sale.endsAt, remainingStock }, now),
    remainingStock,
    startsAt: sale.startsAt.toISOString(),
    endsAt: sale.endsAt.toISOString(),
    serverNow: now.toISOString(),
  };
}
