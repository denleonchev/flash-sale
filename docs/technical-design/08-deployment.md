# 8. Deployment

- **Caddy**, **web**, **api**, and **worker** all run on a **GCP e2-micro** VM via
  `docker-compose`.
- Stateful services are external managed dependencies: Postgres/pgvector on
  Supabase, Redis on Upstash. Only the three Node processes (web, api, worker) and a
  lightweight Caddy (~50 MB) run on the VM, so ~1 GB RAM is enough. (NFR-15)
- **web** runs as a dynamic Next.js Node server, **co-located with api** (same VM):
  it SSRs pages and proxies all client HTTP — including the Buy hot path — to api,
  so it must sit next to api to keep that hop cheap. It holds no application state.
  (NFR-3)
- **Caddy** is the single public entry (reverse proxy + automatic TLS via Let's
  Encrypt): `/socket.io` → api (WS upgrade handled natively), everything else → web.
  The api's REST endpoints are **not** exposed publicly — web reaches them over the
  internal docker network. One browser origin, and api's HTTP surface stays private.
  (NFR-9)
- Secrets come from environment configuration, never the repo. (NFR-8)
- A swap file on the VM is a safety margin against OOM during install/build.
- **Two environments, two GCP projects**: `stage` and `prod`, each its own VM,
  external DB/Redis instance, and Auth0 clients — provisioned from the same
  Terraform config (`infra/gcp/`) via separate workspaces/tfvars. CI/CD
  (`.github/workflows/publish.yml`) builds each image once per commit and
  promotes the same tag to both: stage deploys automatically on push to
  `main`, prod deploys after manual approval on the `production` GitHub
  Environment.
- **Only prod is indexed by search engines.** web reads `SEO_INDEXING_ENABLED` at
  run time; it is `true` only in the prod VM's `.env`. When it is not set, web adds
  `X-Robots-Tag: noindex, nofollow` to every page response. That header is the
  **only** difference between the environments: `sitemap.xml` and `robots.txt` are
  the same on stage, so they can be checked there before prod. `robots.txt` does
  not block stage on purpose: a crawler must be able to open a page to see
  `noindex`, while `Disallow` alone does not keep a linked address out of the
  index. (FR-34)
