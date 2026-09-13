import { defineConfig } from "@playwright/test";
import path from "node:path";

export const STORAGE_STATE = path.join(__dirname, "e2e/.auth/buyer.json");

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 30_000 },
  retries: process.env["CI"] ? 1 : 0,
  globalSetup: "./e2e/global-setup.ts",
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env["APP_BASE_URL"] ?? "http://localhost:3000",
    storageState: STORAGE_STATE,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
