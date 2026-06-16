/**
 * Encodes an Auth0 `sub` (e.g. "auth0|abc123") into a url-safe `buyerId` for the api
 * (S-2.5). base64url output is `[A-Za-z0-9_-]`, so it satisfies the api's CreateOrderDto
 * validation and stays safe as part of the BullMQ jobId (`buyerId-saleId`, no ':'),
 * leaving the api untouched. Stable per user, so idempotency (FR-14) still holds.
 */
export function encodeBuyerId(sub: string): string {
  return Buffer.from(sub, "utf8").toString("base64url");
}
