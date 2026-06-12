import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

/**
 * Next.js config for the web frontend.
 *
 * `output: "standalone"` produces a self-contained server bundle (.next/standalone)
 * so the Docker image (S-E0.3) needs no node_modules at runtime. In a pnpm monorepo
 * Next must trace from the repo root, hence `outputFileTracingRoot` two levels up.
 *
 * When web starts importing @flash-sale/shared (S-1.1), add it to `transpilePackages`.
 */
const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
};

export default config;
