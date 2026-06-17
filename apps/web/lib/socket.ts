import { io, type Socket } from "socket.io-client";

/**
 * Where the browser opens its Socket.IO connection — the only browser→api path (§1).
 * In production it is left unset: `io(undefined)` connects to the page's own origin
 * and nginx routes `/socket.io` to api, so api's address is never exposed and no CORS
 * is needed. In dev there is no nginx, so `NEXT_PUBLIC_SOCKET_URL` points straight at
 * api (e.g. http://localhost:3001). Must be `NEXT_PUBLIC_*` to reach the client. (NFR-8)
 */
export function getSocketUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SOCKET_URL;
}

let socket: Socket | undefined;

/**
 * Lazily-created singleton Socket.IO connection (browser-only — only ever called from
 * client hooks). Created on first use and reused across component mounts and
 * client-side navigations, so moving between sale pages does not tear down and rebuild
 * the connection, and React StrictMode's double-mount in dev does not churn it.
 *
 * An `auth` callback fetches a fresh HMAC ticket from `/api/socket-ticket` on every
 * (re)connect. Authenticated → api joins the socket to the buyer's private room.
 * Anonymous (ticket: null) → socket stays in public sale rooms only. (FR-18)
 *
 * Consumers attach and detach their own listeners (and join sale rooms); they must
 * NOT disconnect this shared socket.
 */
export function getSocket(): Socket {
  socket ??= io(getSocketUrl(), {
    transports: ["websocket"],
    auth: async (cb: (data: Record<string, unknown>) => void) => {
      try {
        const res = await fetch("/api/socket-ticket");
        const { ticket } = (await res.json()) as { ticket: string | null };
        cb(ticket ? { ticket } : {});
      } catch {
        cb({});
      }
    },
  });
  return socket;
}
