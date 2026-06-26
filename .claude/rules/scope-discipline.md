# Rule: Scope discipline — core first, extras last

The SRS marks every requirement **[Core]** or **[Ext]**. This order is not
optional.

## Build order

1. Build the **[Core]** requirements first, end to end, until they work and are
   tested.
2. Only then start **[Ext]** features, in this priority:
   email → fraud screening → semantic search → real payment (test mode).
3. If time or complexity is a problem, drop extras in the **reverse** of that
   order. Never sacrifice core for an extra.

## The core (must work before anything else)

catalog/event → atomic stock reservation (Redis) → enqueue → worker confirm
(Postgres transaction) → live stock + result over Socket.IO.

## Behaviour

- Do **not** scaffold or stub [Ext] features while [Core] is incomplete, even if
  it "would be quick".
- Prefer one finished vertical slice over many half-built features.
- If asked to add something that is [Ext] while [Core] is unfinished, point this
  out and confirm before proceeding.
