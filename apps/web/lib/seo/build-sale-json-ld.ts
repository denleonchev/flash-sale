import { SALE_STATES, type Sale } from "@flash-sale/shared";
import { getSiteUrl } from "./get-site-url";

const AVAILABILITY = {
  PRE_ORDER: "https://schema.org/PreOrder",
  IN_STOCK: "https://schema.org/InStock",
  SOLD_OUT: "https://schema.org/SoldOut",
  DISCONTINUED: "https://schema.org/Discontinued",
} as const;

type Availability = (typeof AVAILABILITY)[keyof typeof AVAILABILITY];

// The api charges in USD (`orders.service.ts`); a sale has no currency of its own.
const PRICE_CURRENCY = "USD";

export type JsonLd = Record<string, unknown>;

// A live sale always has stock left: the api reports a sale with none as ended (FR-2).
function resolveAvailability(sale: Sale): Availability {
  if (sale.state === SALE_STATES.UPCOMING) return AVAILABILITY.PRE_ORDER;
  if (sale.state === SALE_STATES.LIVE) return AVAILABILITY.IN_STOCK;
  return sale.remainingStock <= 0 ? AVAILABILITY.SOLD_OUT : AVAILABILITY.DISCONTINUED;
}

// FR-33
export function buildSaleJsonLd(sale: Sale): JsonLd {
  const url = new URL(`/sales/${sale.id}`, getSiteUrl()).toString();

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: sale.title,
    ...(sale.description && { description: sale.description }),
    sku: sale.id,
    url,
    offers: {
      "@type": "Offer",
      url,
      price: (sale.priceCents / 100).toFixed(2),
      priceCurrency: PRICE_CURRENCY,
      availability: resolveAvailability(sale),
      availabilityStarts: sale.startsAt,
      availabilityEnds: sale.endsAt,
      priceValidUntil: sale.endsAt,
    },
  };
}

export function buildSaleListJsonLd(sales: Sale[]): JsonLd {
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: sales.map((sale, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: sale.title,
      url: new URL(`/sales/${sale.id}`, siteUrl).toString(),
    })),
  };
}
