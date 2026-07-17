import { test } from "@playwright/test";

test("browser crash fixture observes a closed target", async ({
  browser,
  page,
}) => {
  await browser.close();
  await page.title();
});
