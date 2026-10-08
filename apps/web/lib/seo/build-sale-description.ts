import type { Sale, SaleState } from "@flash-sale/shared";

const STATE_NOTES = {
  upcoming: "Starting soon.",
  live: "Live now.",
  ended: "This sale has ended.",
} as const satisfies Record<SaleState, string>;

const MAX_LENGTH = 160;

export function buildSaleDescription(sale: Sale): string {
  const price = (sale.priceCents / 100).toFixed(2);
  const text =
    sale.description ??
    `${sale.title} for $${price} in a limited flash sale. ${STATE_NOTES[sale.state]}`;

  return text.length <= MAX_LENGTH ? text : `${text.slice(0, MAX_LENGTH - 1).trimEnd()}…`;
}
