export function getSiteUrl(): URL {
  return new URL(process.env["APP_BASE_URL"] ?? "http://localhost:3000");
}
