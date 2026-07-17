import AxeBuilder from "@axe-core/playwright";
import { expect, test as base } from "@playwright/test";

const ACCESSIBILITY_TAGS = Object.freeze([
  "wcag2a",
  "wcag2aa",
  "wcag21aa",
  "wcag22aa",
]);
const MAX_REPORTED_VIOLATIONS = 8;
const MAX_REPORTED_NODES = 3;
const MAX_TARGET_LENGTH = 160;

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

export async function analyzeAccessibility(page) {
  return new AxeBuilder({ page }).withTags(ACCESSIBILITY_TAGS).analyze();
}

export function assertNoAccessibilityBlockers(result) {
  if (result === null || !Array.isArray(result?.violations)) {
    throw new Error("accessibility: invalid-result");
  }
  if (result.violations.length === 0) {
    return;
  }

  const summary = result.violations
    .slice(0, MAX_REPORTED_VIOLATIONS)
    .map((violation) => {
      const targets = Array.isArray(violation.nodes)
        ? violation.nodes
            .slice(0, MAX_REPORTED_NODES)
            .flatMap((node) => (Array.isArray(node.target) ? node.target : []))
            .join("|")
            .slice(0, MAX_TARGET_LENGTH)
        : "unknown-target";
      return `${String(violation.id).slice(0, 64)}:${String(
        violation.impact ?? "unknown-impact",
      ).slice(0, 32)}:${targets}`;
    })
    .join("; ");

  throw new Error(`accessibility: ${summary}`);
}

export async function openGameShell(page) {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response?.status(), "game shell response status").toBe(200);
  await page.evaluate(() => globalThis.document.fonts.ready);

  const shell = page.locator('main[data-game-shell="interactive"]');
  await expect(shell).toHaveAttribute("data-shell-status", "idle");
  await expect(page.locator("nextjs-portal")).toHaveCount(0);
  await shell.evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
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
