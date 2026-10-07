# 5. Data Model

Postgres via **Prisma**. No separate products table; user identity is offloaded to
Auth0 with a thin `users` mirror for display and email. pgvector serves two
purposes: fraud screening (order signal embeddings) and semantic search
(sale title/description embeddings).

- **users** — `auth0_sub` (base64url-encoded Auth0 `sub`, PK), `email`,
  `name` (nullable — not guaranteed by all Auth0 providers), `created_at`. Populated
  via upsert when a buyer places their first order. Auth0 remains the identity source
  of truth; this table caches only what the app needs locally (display name for fraud
  flags, email address for transactional email FR-23).
- **sales** — `id`, `title`, `description`, `stock_total`, `price_cents`,
  `starts_at`, `ends_at`, `created_at`, `embedding vector` _(Ext)_. Product details
  live directly on the sale row — there is no separate products table. The embedding
  is computed in the background from `title` + `description` and used for semantic
  search. State (upcoming/live/ended) is derived, not
  stored. (FR-1, FR-2)
- **orders** — `id`, `sale_id`, `buyer_id` (base64url-encoded Auth0 `sub`),
  `idempotency_key` (unique per buyer+sale), `status` (in*progress | confirmed |
  sold_out | failed | expired), `payment_ref` *(Ext)\_, `acknowledged_at`,
  `created_at`. api writes `in_progress` before enqueue; the worker transitions it to
  exactly one terminal status. `expired` is an abandoned checkout closed by
  reconciliation (FR-28). The unique key enforces idempotency at the DB level too.
  `acknowledged_at` is set when the buyer confirms receipt of the result; subsequent
  reconnect snapshots are suppressed once it is set. (FR-14, FR-19)
- **fraud_flags** _(Ext)_ — `id`, `order_id`, `buyer_id`, `sale_id`, `risk`,
  `reason`, `pattern`, `embedding vector`, `status` (open | confirmed | rejected),
  `created_at`, `reviewed_at`. (FR-22)
- **fraud_flag_citations** _(Ext)_ — `flag_id`, `position`, `cited_flag_id`,
  `distance`. The confirmed flags that were put into the prompt when `flag_id` was
  screened, in prompt order, with their vector distance at that moment. Lets a
  moderator see the evidence behind a verdict. Primary key (`flag_id`, `position`).

Authoritative stock lives in Postgres (`stock_total` minus confirmed orders). The
Redis counter is a fast working copy for the hot path; the database is the source of
truth.
