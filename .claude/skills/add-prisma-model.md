# Skill: Add or change a Prisma model

How to add or modify a database model in this repo.

## Steps

1. Edit the Prisma schema (`apps/api` or a shared prisma package, wherever the
   schema lives in this repo) to add/change the model.
2. Keep names and fields aligned with the data model in
   `docs/technical-design.md` (section 5). If you need a field that isn't there,
   flag it.
3. If the change affects types used across services, update `packages/shared`
   too, so api and worker agree.
4. **Do not run the migration.** Propose the exact command for the human, e.g.:
   `pnpm --filter api prisma migrate dev --name <descriptive_name>`
   and state what tables/columns it will create or alter.
5. Wait for the human to apply it and confirm before writing code that depends on
   the new schema.

## Notes

- Use a unique constraint where the data model calls for idempotency
  (e.g. orders unique on buyer+sale).
- `vector` (pgvector) and `jsonb` columns: follow the design doc; these may need
  raw SQL in the migration — point that out.
