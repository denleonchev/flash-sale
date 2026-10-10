import { NextResponse, type NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0";
import { isIndexingEnabled } from "@/lib/seo/is-indexing-enabled";

const HOME_PATH = "/";
const HOME_CACHE_CONTROL = "no-cache";

/**
 * Mounts the Auth0 auth routes (/auth/login, /auth/logout, /auth/callback) and
 * keeps the session cookie fresh on every request (S-2.5, FR-6). Next 16 renamed
 * the `middleware` convention to `proxy`; `auth0.middleware()` is the SDK method and
 * keeps its name.
 */
export async function proxy(request: NextRequest): Promise<Response> {
  const isHomeDocument = request.method === "GET" && request.nextUrl.pathname === HOME_PATH;
  const response = isHomeDocument ? NextResponse.next() : await auth0.middleware(request);
  if (isHomeDocument) {
    response.headers.set("Cache-Control", HOME_CACHE_CONTROL);
  }
  if (!isIndexingEnabled()) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
