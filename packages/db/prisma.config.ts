import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// The monorepo keeps a single .env at the repo root. Prisma runs with cwd =
// packages/db (via `pnpm --filter @flash-sale/db ...`), so load the root .env two
// levels up — otherwise dotenv looks for packages/db/.env, which does not exist.
config({ path: "../../.env" });

type Env = { DATABASE_URL: string };

/**
 * Prisma 7 config. The CLI reads the connection URL from here (no longer from the
 * schema's datasource). NFR-8: the value comes from env (DATABASE_URL); for Supabase
 * migrations this must be the DIRECT connection (port 5432). The pooled/runtime split
 * (driver adapter) lands when api/worker connect to the DB (S-E0.4).
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env<Env>("DATABASE_URL") },
});
