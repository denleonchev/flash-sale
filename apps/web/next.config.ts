import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

/**
 * Next.js config for the web frontend.
 *
 * `output: "standalone"` produces a self-contained server bundle (.next/standalone)
 * so the Docker image (S-E0.3) needs no node_modules at runtime. In a pnpm monorepo
 * Next must trace from the repo root, hence `outputFileTracingRoot` two levels up.
 *
 * `transpilePackages` lets Next compile the workspace `@flash-sale/shared` package
 * (S-1.1) instead of treating it as a prebuilt external.
 */
const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  transpilePackages: ["@flash-sale/shared"],
};

export default config;
