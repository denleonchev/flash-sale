# Rule: Coding style & conventions

- **TypeScript everywhere**, strict mode. No implicit `any`.
- Shared types (queue jobs, DTOs, enums, order/event shapes) live in
  `packages/shared` and are imported by both `api` and `worker`. Do not duplicate
  these types per app.
- Small, focused commits with clear messages. One concern per change.
- Reference requirement IDs (FR-/NFR-) in comments where a piece of code exists to
  satisfy a specific requirement.

## Comments

Write no comment by default. Add one only when the **WHY** is non-obvious from the
code itself — a hidden constraint, a non-obvious invariant, a deliberate trade-off,
or a workaround for a specific external behaviour.

**Keep:**

- FR-/NFR- requirement references (`// FR-15: must never exceed stockTotal`).
- Concurrency reasoning — required by `concurrency.md` for any stock/queue/confirm code.
- Non-obvious constraints: env-var names and defaults, atomicity guarantees, retry
  semantics, subtle ordering requirements.
- Trade-off notes: why a simpler approach was rejected, known under-count trade-off, etc.

**Remove:**

- Anything that restates what the code already says clearly: "creates an order row",
  "returns all sales", "iterates over items".
- Class-level JSDoc that just names the class's role ("Raw DB access for orders").
  The file name and directory already say this.
- Method JSDoc whose only content is "delegates to X" or echoes the method signature.
- Inline `// FR-N: tell the buyer their result.` on a call to `publishOrderResult()` —
  the method name is the comment.
