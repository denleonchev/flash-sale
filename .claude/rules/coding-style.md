# Rule: Coding style & conventions

- **TypeScript everywhere**, strict mode. No implicit `any`.
- Shared types (queue jobs, DTOs, enums, order/event shapes) live in
  `packages/shared` and are imported by both `api` and `worker`. Do not duplicate
  these types per app.
- Small, focused commits with clear messages. One concern per change.
- Reference requirement IDs (FR-/NFR-) in comments where a piece of code exists to
  satisfy a specific requirement.
