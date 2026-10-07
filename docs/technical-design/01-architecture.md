# 1. Architecture Overview

Three application services (self-hosted, one monorepo) and three external managed
dependencies.

Application services:

- **web** — Next.js, run as a dynamic Node server. Renders pages (SSR) and acts as
  the BFF for the browser: all client HTTP (page loads and actions like Buy) goes to
  web, which calls api server-to-server. Holds no application state. (NFR-8)
- **api** — Nest: HTTP endpoints + Socket.IO gateway. Accepts purchases (forwarded
  by web) and owns the realtime sockets. The browser connects to api **directly only**
  for the WebSocket.
- **worker** — Nest: consumes the queue, processes orders one at a time.

External managed dependencies:

- **Postgres + pgvector** (Supabase) — durable data, vector similarity for fraud
  screening, and semantic search of sales.
- **Redis** (Upstash) — atomic stock reservation, queue backend, pub/sub fan-out,
  and caching.
- **AI / email providers** — Groq (text LLM) and an email provider; both optional
  and off the purchase path.

```
                     ┌──────────────┐
                     │   browser    │
                     └──────┬───────┘
                            │  HTTP + Socket.IO (single public origin)
                            ▼
                     ┌──────────────┐
                     │    caddy     │  reverse proxy + TLS (only public entry)
                     └───┬───────┬──┘
          / (pages, buy) │       │ /socket.io (WS upgrade)
                         ▼       ▼
                   ┌─────────┐  ┌─────────┐   BullMQ job    ┌──────────┐
                   │   web   │─►│   api   │ ──────────────► │  worker  │
                   │ (Next)  │  │  (Nest) │ ◄── pub/sub ─── │  (Nest)  │
                   └─────────┘  └────┬────┘    result       └────┬─────┘
              server→server          │   (REST api: internal     │
              (SSR + buy)            │    network only)          │
                          ┌──────────┼──────────────┬───────────┤
                          ▼          ▼              ▼           ▼
                      Postgres     Redis        Redis (queue) Groq /
                     (Supabase)  (reserve +    (BullMQ)       email
                                 pub/sub +                    (optional)
                                 cache)
```

A single **Caddy** reverse proxy is the only public entry (see §8): it terminates
TLS, routes page and BFF traffic to **web** and the `/socket.io` WebSocket to **api**.
So the browser sees one origin, and the api's REST endpoints are **never exposed
publicly** — web reaches them server-side over the internal network. The Socket.IO
connection is the only browser-side path that reaches api (proxied by Caddy); all
other client HTTP goes through web, which forwards Buy to api server-side and must
sit next to api on the hot path. The `api` accepts requests fast and never does heavy work inline; the
`worker` does the slow, careful work in the background. They share no in-memory
state — they communicate only through the queue and Redis pub/sub.
(NFR-3, NFR-9, NFR-10, NFR-11)
