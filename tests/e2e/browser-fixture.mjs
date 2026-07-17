import { expect, test as base } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use) => {
    const browserErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        browserErrors.push(`console: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      browserErrors.push(`page: ${error.message}`);
    });

    await use(page);

    expect(browserErrors, "browser runtime errors").toEqual([]);
  },
});

export { expect };

export async function openGameShell(page) {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response?.status(), "game shell response status").toBe(200);
  await page.evaluate(() => globalThis.document.fonts.ready);

  const shell = page.locator('main[data-game-shell="interactive"]');
  await expect(shell).toHaveAttribute("data-shell-status", "idle");
  await expect(page.locator("nextjs-portal")).toHaveCount(0);
  return shell;
}

export async function expectMinimumTarget(locator, minimum, label) {
  const box = await locator.boundingBox();
  expect(box, `${label} target size box`).not.toBeNull();
  expect(box.width, `${label} target size width`).toBeGreaterThanOrEqual(
    minimum,
  );
  expect(box.height, `${label} target size height`).toBeGreaterThanOrEqual(
    minimum,
  );
}

export async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: globalThis.document.documentElement.clientWidth,
    scrollWidth: globalThis.document.documentElement.scrollWidth,
  }));
  expect(
    dimensions.scrollWidth,
    "document horizontal overflow",
  ).toBeLessThanOrEqual(dimensions.clientWidth);
}
