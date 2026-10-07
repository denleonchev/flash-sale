# 7. Background Jobs (Ext)

All optional features are background jobs in the worker, off the purchase path, so
the core flow works fully without them. (NFR-13)

- **Fraud screening** — after order creation: gather signals → embed them locally
  (transformers.js) → vector similarity search (pgvector) for known patterns → Groq
  scores risk → if risky, Groq drafts a reviewer note → store a `fraud_flag`. Per
  order, never on a stream, to respect Groq's rate limits. The similar cases that
  went into the prompt are stored with the flag (`fraud_flag_citations`) and shown
  to the moderator next to the verdict. (FR-20–22)
- **Email** — a separate job type, sent with retries and idempotency (one email per
  outcome); a failed provider call is retried with backoff. (FR-23–25, NFR-6)
- **Sale embeddings** — computed locally (transformers.js / ONNX) from `title` +
  `description`, stored as a pgvector column on the sale row. Run lazily in the
  background, one at a time, so the VM is never blocked. Powers semantic search
  (FR-26). (NFR-14)
