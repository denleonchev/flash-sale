# Rule: Concurrency — special care for oversell prevention

This is the most important and most error-prone part of the system. AI tends to
produce concurrency code that looks correct, compiles, passes a casual manual test,
and is still wrong under real concurrent load. Treat it accordingly.

**The design is canonical in `docs/technical-design/04-purchase-flow.md` (§4) and, for
orders that do not finish on their own (reconciliation, stock release, counter rebuild),
`docs/technical-design/10-order-lifecycle.md` (§10).** This file does not restate the
mechanism — read those for _how_ it works and _why_ it is correct. This file is the _operating rule_ for working on that code.

## Hard rules

- Any code touching **stock reservation, the order queue, or stock confirmation**
  must be accompanied by a **plain-language explanation** of _why_ it is correct
  under concurrent access — which operation is atomic, what serialises access, what
  happens when two buyers hit the last unit at the same time.
- Never describe such code as "done" or "working" without that reasoning. The human
  verifies it manually before it is trusted.
- Follow the design in §4 and §10. Do not introduce a new concurrency approach without
  flagging it and explaining the trade-off versus the documented design.

## When unsure

Stop and ask. A wrong guess here defeats the whole point of the project.
