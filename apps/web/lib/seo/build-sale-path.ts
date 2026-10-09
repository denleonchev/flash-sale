import type { Sale } from "@flash-sale/shared";

const UUID_LENGTH = 36;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SLUG_LENGTH = 60;

// ASCII only, so the slug looks the same before and after URL encoding and the
// "is this the canonical address?" check on the sale page cannot loop.
function buildSaleSlug(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, "");
}

export function buildSalePath(sale: Pick<Sale, "id" | "title">): string {
  const slug = buildSaleSlug(sale.title);
  return slug ? `/sales/${slug}-${sale.id}` : `/sales/${sale.id}`;
}

export function parseSaleIdFromParam(param: string): string | null {
  const id = param.slice(-UUID_LENGTH);
  return UUID_PATTERN.test(id) ? id : null;
}
