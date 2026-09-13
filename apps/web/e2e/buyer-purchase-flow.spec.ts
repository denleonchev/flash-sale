import { test, expect } from "@playwright/test";
import { seedLiveSale } from "./fixtures/seed-sale";

test("buyer completes a purchase end-to-end", async ({ page }) => {
  const sale = await seedLiveSale(2);
  const remainingStock = page.locator("p.text-red-400");

  await page.goto(`/sales/${sale.id}`);
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
  await expect(remainingStock).toHaveText("2");

  const cardFrame = page.frameLocator('iframe[title="Secure card payment input frame"]');
  await cardFrame.locator('[name="cardnumber"]').fill("4242424242424242");
  await cardFrame.locator('[name="exp-date"]').fill("12/34");
  await cardFrame.locator('[name="cvc"]').fill("123");

  await page.getByRole("button", { name: "Buy now" }).click();
  await expect(page.getByText("Processing…")).toBeVisible();

  await expect(page.getByText("✓ Order confirmed!")).toBeVisible();
  await expect(remainingStock).toHaveText("1");
});
