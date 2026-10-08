// FR-34: off unless switched on. Only the prod environment sets SEO_INDEXING_ENABLED=true,
// so stage, local and any future environment stay out of search engines by default.
export function isIndexingEnabled(): boolean {
  return process.env["SEO_INDEXING_ENABLED"] === "true";
}
