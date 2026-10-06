import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    include: ["src/**/*.integration.test.ts"],
    // Tests share one Postgres and one Redis.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
