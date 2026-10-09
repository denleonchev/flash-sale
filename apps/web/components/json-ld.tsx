import type { JsonLd as JsonLdData } from "@/lib/seo/build-sale-json-ld";

export function JsonLd({ data }: { data: JsonLdData }) {
  // Titles and descriptions are typed by an admin. JSON.stringify does not escape "<",
  // so a value containing "</script>" would close the tag and run as markup.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
