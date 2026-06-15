const BASE_URL = process.env["API_INTERNAL_URL"] ?? "http://localhost:3001";

/** Server-only fetch against the internal api. Always no-store — all sales data is volatile (FR-2 / NFR-2). */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, { cache: "no-store", ...init });
}
