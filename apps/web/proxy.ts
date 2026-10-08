import type { NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0";
import { isIndexingEnabled } from "@/lib/seo/is-indexing-enabled";

/**
 * Mounts the Auth0 auth routes (/auth/login, /auth/logout, /auth/callback) and
 * keeps the session cookie fresh on every request (S-2.5, FR-6). Next 16 renamed
 * the `middleware` convention to `proxy`; `auth0.middleware()` is the SDK method and
 * keeps its name.
 */
export async function proxy(request: NextRequest): Promise<Response> {
  const response = await auth0.middleware(request);
  if (!isIndexingEnabled()) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
