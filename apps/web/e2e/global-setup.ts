import { chromium } from "@playwright/test";
import { STORAGE_STATE } from "../playwright.config";

export default async function globalSetup(): Promise<void> {
  const email = process.env["E2E_TEST_USER_EMAIL"];
  const password = process.env["E2E_TEST_USER_PASSWORD"];
  if (!email || !password) {
    throw new Error("E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD are required");
  }

  const baseURL = process.env["APP_BASE_URL"] ?? "http://localhost:3000";
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${baseURL}/auth/login`);
  await page.locator("#username").fill(email);
  await page.locator("#password").fill(password);
  // Auth0's login page also renders social buttons ("Continue with Google") that match
  // the same accessible name — data-action-button-primary marks the password submit.
  await page.locator('button[data-action-button-primary="true"]').click();

  await page.waitForURL(`${baseURL}/**`);
  await page.context().storageState({ path: STORAGE_STATE });
  await browser.close();
}
