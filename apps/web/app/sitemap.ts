import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/get-site-url";
import { getSales } from "./sales/get-sales";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const sales = await getSales();

  return [
    { url: new URL("/", siteUrl).toString() },
    { url: new URL("/sales", siteUrl).toString() },
    ...sales.map((sale) => ({ url: new URL(`/sales/${sale.id}`, siteUrl).toString() })),
  ];
}
