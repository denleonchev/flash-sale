import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/get-site-url";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/auth"],
    },
    sitemap: new URL("/sitemap.xml", getSiteUrl()).toString(),
  };
}
