# 9. Key Decisions & Trade-offs

- **Stock correctness: Redis + queue + Postgres.** Mechanism in §4. In short: three
  layers for three needs — Redis for a fast atomic reject on the hot path, the queue
  to remove parallelism during finalisation, Postgres for the durable guarantee.
  Most moving parts of any option; Postgres-only would suffice for tiny real load,
  but demonstrating the correct concurrent design is the point. (NFR-1, FR-10, FR-15)
- **Queue: BullMQ.** Runs on the Redis already present, so no new infrastructure;
  gives retries, backoff, delays, and concurrency control out of the box. Tied to
  Redis and not a general-purpose broker — RabbitMQ/Kafka would be the answer only
  at far larger scale. (NFR-11)
- **Real-time: Socket.IO + Redis adapter.** Reconnection, rooms, and cross-instance
  broadcasting are built in — the hard parts, solved. Heavier than raw `ws`; SSE or
  `ws` would be leaner if updates were one-way from one instance. (NFR-4, NFR-10)
- **ORM: Prisma.** Strong type-safety, clean migrations, broad support (incl.
  pgvector), and AI tools handle it well. The cost — explicit locking / guarded
  updates need `$queryRaw` — is small, since those concurrency-critical spots are
  hand-written and hand-verified anyway.
- **One Postgres + pgvector, not a second database.** Both vector use cases (fraud
  screening and semantic search) live in the same DB already present — no extra
  infrastructure, no cross-store consistency problem.
- **Sockets on a VM, not Cloud Run.** On Cloud Run an open WebSocket keeps an
  instance active (billed, won't scale to zero), connections face a request timeout
  and best-effort affinity, and a queue-consuming worker wants to run continuously.
  A small always-on VM avoids all of this for short-lived drop sessions. At larger
  scale the answer flips to Cloud Run + the Socket.IO Redis adapter. (NFR-4, NFR-10)
- **Fake payment by default, real provider (test mode) as an extension.** The hard
  problem is concurrency, not payments; a simulated step exercises the flow, and
  test-mode Stripe slots in later behind the same outcome contract. (FR-11, FR-12)
- **Monorepo with a shared contract package.** Keeps the queue job/event types in
  sync between api and worker in one place; pnpm workspaces, no heavy orchestrator
  needed at this size.
