import { Auth0Client } from "@auth0/nextjs-auth0/server";

/**
 * Auth0 client for the web BFF (S-2.5, FR-6). Configured entirely from env
 * (AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET, APP_BASE_URL;
 * NFR-8). No DB hooks — identity is offloaded to Auth0, we keep no local user store
 * (buyerId is the encoded Auth0 `sub`). `auth0.middleware` (see proxy.ts) mounts
 * /auth/login|logout|callback; `auth0.getSession()` reads the session server-side.
 */
export const auth0 = new Auth0Client();
