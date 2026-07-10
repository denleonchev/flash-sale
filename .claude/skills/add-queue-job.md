# Skill: Add a BullMQ queue job

How to add a new background job type.

## Steps

1. Define the **job payload type** in `packages/shared`. Both the producer (api or
   worker) and the consumer (worker) import it — never redefine it locally. Include
   an optional `traceparent?: string` field — the producer fills it via
   `propagation.inject` before `.add()`, the consumer wraps `process()` in
   `runWithJobTrace` (`apps/worker/src/tracing/with-job-trace.ts`) so the job's span
   joins the trace that created it instead of starting a disconnected one.
2. Producer: enqueue with a **stable job id** when idempotency matters (e.g. the
   order idempotency key), so duplicates collapse to one job.
3. Consumer (worker): set the right **concurrency**. Order processing per event is
   **one at a time** — do not parallelise it. Background extras (email, embeddings)
   may run with small concurrency but must stay off the purchase path.
4. Handle failure: rely on BullMQ retries with backoff for external calls
   (email/payment). Make handlers **idempotent** — a retry must not double its
   effect.
5. Add a test for the handler's core behaviour.

## Cautions

- Anything affecting stock/orders falls under `.claude/rules/concurrency.md` —
  explain correctness, let the human verify.
