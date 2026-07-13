import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const completedFixture = "/?state=completed";
const cssPixelRoundingTolerance = 0.01;
const minimumUsefulLogHeight = 44;
const visualBaselineProjects = new Set([
  "mobile-320",
  "mobile-390",
  "desktop-1440",
  "landscape-568",
]);

async function expectInsideViewport(locator: Locator, page: Page) {
  await expect(locator).toBeVisible();

  const box = await locator.boundingBox();
  const viewport = page.viewportSize();

  expect(
    box,
    "expected the visible control to have a bounding box",
  ).not.toBeNull();
  expect(
    viewport,
    "expected the Playwright project to define a viewport",
  ).not.toBeNull();

  if (!box || !viewport) {
    return;
  }

  expect.soft(box.x).toBeGreaterThanOrEqual(-1);
  expect.soft(box.y).toBeGreaterThanOrEqual(-1);
  expect.soft(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect.soft(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function expectInsideHorizontalSafeArea(
  locator: Locator,
  page: Page,
  safeArea: { left: number; right: number },
) {
  await expect(locator).toBeVisible();

  const box = await locator.boundingBox();
  const viewport = page.viewportSize();

  expect(
    box,
    "expected the safe-area control to have a bounding box",
  ).not.toBeNull();
  expect(
    viewport,
    "expected the safe-area project to define a viewport",
  ).not.toBeNull();

  if (!box || !viewport) {
    return;
  }

  expect
    .soft(box.x)
    .toBeGreaterThanOrEqual(safeArea.left - cssPixelRoundingTolerance);
  expect
    .soft(box.x + box.width)
    .toBeLessThanOrEqual(
      viewport.width - safeArea.right + cssPixelRoundingTolerance,
    );
}

async function openCompletedFixture(page: Page) {
  await page.goto(completedFixture);
  await expect(page.getByTestId("game-shell")).toHaveAttribute(
    "data-turn-state",
    "completed",
  );
}

async function expectUsefulLogIntersection(log: Locator) {
  await expect(log).toBeVisible();

  const metrics = await log.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const intersectionHeight = Math.max(
      0,
      Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0),
    );
    const intersectionWidth = Math.max(
      0,
      Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0),
    );

    return {
      clientHeight: element.clientHeight,
      intersectionHeight,
      intersectionWidth,
      width: rect.width,
    };
  });

  expect(metrics.clientHeight).toBeGreaterThanOrEqual(minimumUsefulLogHeight);
  expect(metrics.intersectionHeight).toBeGreaterThanOrEqual(
    minimumUsefulLogHeight,
  );
  expect(metrics.intersectionWidth).toBeGreaterThanOrEqual(
    metrics.width - cssPixelRoundingTolerance,
  );
}

async function expectFocusInside(dialog: Locator) {
  await expect
    .poll(() =>
      dialog.evaluate((element) => element.contains(document.activeElement)),
    )
    .toBe(true);
}

async function waitForVisualStability(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() => page.evaluate(() => document.fonts.status))
    .toBe("loaded");
  await expect
    .poll(() =>
      page.locator("[data-game-motion]").evaluateAll((elements) =>
        elements.every((element) => {
          const transform = getComputedStyle(element).transform;
          return transform === "none" || transform.endsWith(", 0, 0)");
        }),
      ),
    )
    .toBe(true);
}

test.describe("BL-079 responsive game shell", () => {
  test("keeps the core loop inside every configured viewport", async ({
    page,
  }) => {
    await openCompletedFixture(page);

    const overflow = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>(
        '[data-testid="game-shell"]',
      );

      return {
        body: document.body.scrollWidth,
        document: document.documentElement.scrollWidth,
        shellClient: shell?.clientWidth ?? 0,
        shellScroll: shell?.scrollWidth ?? 0,
        viewport: document.documentElement.clientWidth,
      };
    });

    expect.soft(overflow.document).toBeLessThanOrEqual(overflow.viewport + 1);
    expect.soft(overflow.body).toBeLessThanOrEqual(overflow.viewport + 1);
    expect
      .soft(overflow.shellScroll)
      .toBeLessThanOrEqual(overflow.shellClient + 1);

    await expectInsideViewport(page.getByTestId("game-shell"), page);
    await expectUsefulLogIntersection(
      page.getByRole("log", { name: "Cronologia dell'avventura" }),
    );
    await expectInsideViewport(
      page.getByRole("button", {
        name: "Esamino la sequenza senza toccarla",
      }),
      page,
    );
    await expectInsideViewport(
      page.getByRole("button", { name: "Chiedo a Nara cosa riconosce" }),
      page,
    );
    await expectInsideViewport(
      page.getByRole("textbox", { name: "Scrivi la tua azione" }),
      page,
    );
    await expectInsideViewport(
      page.getByRole("button", { name: "Invia azione" }),
      page,
    );

    const hud = page.getByRole("navigation", { name: "Pannelli di gioco" });
    if (await hud.isVisible()) {
      await expectInsideViewport(hud, page);

      const hudButtons = hud.getByRole("button");
      const hudButtonCount = await hudButtons.count();
      for (let index = 0; index < hudButtonCount; index += 1) {
        await expectInsideViewport(hudButtons.nth(index), page);
      }
    }
  });

  test("opens a tall DM reply from its speaker and beginning on compact screens", async ({
    page,
  }, testInfo) => {
    test.skip(
      !["mobile-320", "landscape-568"].includes(testInfo.project.name),
      "initial feed anchor contract applies to the two compact reference viewports",
    );

    await openCompletedFixture(page);

    const log = page.getByRole("log", {
      name: "Cronologia dell'avventura",
    });
    const scrollViewport = log.locator(":scope > div").first();
    const dmReply = log.getByRole("article", {
      name: "Messaggio di Dungeon Master",
    });
    const speaker = dmReply.getByText("Dungeon Master", { exact: true });

    await expect(speaker).toBeInViewport({ ratio: 1 });

    const initialAnchor = await dmReply.evaluate((message) => {
      const logElement = message.closest('[role="log"]');
      const scrollElement = logElement?.firstElementChild;
      const firstParagraph = message.querySelector("p");
      const firstTextNode = Array.from(firstParagraph?.childNodes ?? []).find(
        (node) =>
          node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
      );

      if (
        !(scrollElement instanceof HTMLElement) ||
        !(firstTextNode instanceof Text) ||
        !firstTextNode.textContent
      ) {
        return null;
      }

      const firstVisibleCharacter = firstTextNode.textContent.search(/\S/);
      const startOffset = Math.max(0, firstVisibleCharacter);
      const range = document.createRange();
      range.setStart(firstTextNode, startOffset);
      range.setEnd(
        firstTextNode,
        Math.min(firstTextNode.textContent.length, startOffset + 24),
      );

      const messageRect = message.getBoundingClientRect();
      const scrollRect = scrollElement.getBoundingClientRect();
      const textStartRect = range.getBoundingClientRect();

      return {
        anchorDistance: messageRect.top - scrollRect.top,
        beginningIsVisible:
          textStartRect.top >= scrollRect.top - 1 &&
          textStartRect.bottom <= scrollRect.bottom + 1,
        messageHeight: messageRect.height,
        viewportHeight: scrollElement.clientHeight,
      };
    });

    expect(initialAnchor).not.toBeNull();
    expect(initialAnchor?.messageHeight).toBeGreaterThan(
      initialAnchor?.viewportHeight ?? Number.POSITIVE_INFINITY,
    );
    expect(initialAnchor?.anchorDistance).toBeGreaterThanOrEqual(0);
    expect(initialAnchor?.anchorDistance).toBeLessThanOrEqual(12);
    expect(initialAnchor?.beginningIsVisible).toBe(true);

    await scrollViewport.evaluate((element) => {
      const content = element.firstElementChild;
      const appendedTurn = document.createElement("div");
      appendedTurn.style.minHeight = "160px";
      appendedTurn.textContent = "Nuovo contenuto del turno";
      content?.append(appendedTurn);
    });
    await expect
      .poll(() =>
        scrollViewport.evaluate(
          (element) =>
            element.scrollHeight - element.clientHeight - element.scrollTop,
        ),
      )
      .toBeLessThanOrEqual(2);
  });

  test("keeps provisional streaming and reconnect feeds pinned to the latest content", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-320",
      "single compact regression run for live states",
    );

    for (const state of ["streaming_provisional", "reconnect"] as const) {
      await page.goto(`/?state=${state}`);

      const scrollViewport = page
        .getByRole("log", { name: "Cronologia dell'avventura" })
        .locator(":scope > div")
        .first();

      await expect
        .poll(() =>
          scrollViewport.evaluate(
            (element) =>
              element.scrollHeight - element.clientHeight - element.scrollTop,
          ),
        )
        .toBeLessThanOrEqual(2);
    }
  });

  test("meets minimum touch targets on touch projects", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.use.hasTouch,
      "touch target contract applies to touch projects",
    );

    await openCompletedFixture(page);

    const buttons = page.getByTestId("game-shell").locator("button:visible");
    const buttonCount = await buttons.count();

    expect(buttonCount).toBeGreaterThan(0);

    for (let index = 0; index < buttonCount; index += 1) {
      const button = buttons.nth(index);
      const box = await button.boundingBox();
      const accessibleName = await button.getAttribute("aria-label");
      const visibleText = (await button.innerText()).trim();
      const controlName =
        accessibleName || visibleText || `button ${index + 1}`;

      expect(
        box,
        `${controlName} should have a measurable touch target`,
      ).not.toBeNull();
      if (!box) {
        continue;
      }

      expect
        .soft(box.width, `${controlName} should be at least 44 CSS px wide`)
        .toBeGreaterThanOrEqual(44 - cssPixelRoundingTolerance);
      expect
        .soft(box.height, `${controlName} should be at least 44 CSS px tall`)
        .toBeGreaterThanOrEqual(44 - cssPixelRoundingTolerance);
    }

    const primaryAction = page.getByRole("button", {
      name: "Esamino la sequenza senza toccarla",
    });
    const submitAction = page.getByRole("button", { name: "Invia azione" });

    for (const action of [primaryAction, submitAction]) {
      const box = await action.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect
          .soft(box.height)
          .toBeGreaterThanOrEqual(48 - cssPixelRoundingTolerance);
      }
    }
  });

  test("keeps the composer visible when the viewport is reduced", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-390",
      "representative virtual keyboard viewport",
    );

    await openCompletedFixture(page);
    await page.setViewportSize({ height: 420, width: 390 });

    const input = page.getByRole("textbox", { name: "Scrivi la tua azione" });
    await input.focus();

    await expectInsideViewport(input, page);
    await expectInsideViewport(
      page.getByRole("button", { name: "Invia azione" }),
      page,
    );
  });

  test("preserves the feed and composer with a narrow virtual keyboard", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-320",
      "narrowest virtual keyboard viewport",
    );

    await openCompletedFixture(page);
    await page.setViewportSize({ height: 300, width: 320 });

    await expectUsefulLogIntersection(
      page.getByRole("log", { name: "Cronologia dell'avventura" }),
    );
    await expect(page.getByTestId("suggested-actions")).toBeHidden();
    await expect(
      page.getByRole("navigation", { name: "Pannelli di gioco" }),
    ).toBeHidden();
    await expectInsideViewport(
      page.getByRole("textbox", { name: "Scrivi la tua azione" }),
      page,
    );
    await expectInsideViewport(
      page.getByRole("button", { name: "Invia azione" }),
      page,
    );
  });

  test("keeps mobile controls above emulated safe-area insets", async ({
    context,
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-390",
      "representative notched mobile viewport",
    );

    const session = await context.newCDPSession(page);
    await session.send("Emulation.setSafeAreaInsetsOverride", {
      insets: { bottom: 34, left: 0, right: 0, top: 20 },
    });

    try {
      await openCompletedFixture(page);

      const hud = page.getByRole("navigation", { name: "Pannelli di gioco" });
      const hudButton = hud.getByRole("button", { name: "Inventario" });
      await expectInsideViewport(hud, page);
      await expectInsideViewport(hudButton, page);

      const bottomClearance = await hudButton.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return window.innerHeight - rect.bottom;
      });
      const hudPaddingBottom = await hud.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).paddingBottom),
      );

      expect(bottomClearance).toBeGreaterThanOrEqual(34);
      expect(hudPaddingBottom).toBeGreaterThanOrEqual(34);
    } finally {
      await session.send("Emulation.setSafeAreaInsetsOverride", {
        insets: {},
      });
    }
  });

  test("keeps the landscape shell and drawer inside horizontal safe-area insets", async ({
    context,
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "landscape-568",
      "representative landscape notch viewport",
    );

    const safeArea = { left: 44, right: 44 };
    const session = await context.newCDPSession(page);
    await session.send("Emulation.setSafeAreaInsetsOverride", {
      insets: {
        bottom: 21,
        left: safeArea.left,
        right: safeArea.right,
        top: 0,
      },
    });

    try {
      await openCompletedFixture(page);

      const shellContent = [
        page.getByRole("heading", { level: 1 }),
        page.getByRole("log", { name: "Cronologia dell'avventura" }),
        page.getByRole("button", {
          name: "Esamino la sequenza senza toccarla",
        }),
        page.getByRole("button", { name: "Chiedo a Nara cosa riconosce" }),
        page.getByRole("textbox", { name: "Scrivi la tua azione" }),
        page.getByRole("button", { name: "Invia azione" }),
        page.getByTestId("game-menu"),
      ];

      for (const locator of shellContent) {
        await expectInsideHorizontalSafeArea(locator, page, safeArea);
      }

      await page.getByTestId("game-menu").click();
      const dialog = page.getByRole("dialog", { name: "Dettagli avventura" });
      await expect(dialog).toBeVisible();

      const drawerPadding = await dialog.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          left: Number.parseFloat(style.paddingLeft),
          right: Number.parseFloat(style.paddingRight),
        };
      });
      expect(drawerPadding.left).toBeGreaterThanOrEqual(safeArea.left);
      expect(drawerPadding.right).toBeGreaterThanOrEqual(safeArea.right);

      const drawerContent = [
        dialog.locator('[data-slot="drawer-title"]'),
        dialog.getByRole("button", { name: "Chiudi Dettagli avventura" }),
        dialog.getByRole("region", {
          name: "Contenuto Dettagli avventura",
        }),
        dialog.getByTestId("current-objective"),
      ];

      for (const locator of drawerContent) {
        await expectInsideHorizontalSafeArea(locator, page, safeArea);
      }
    } finally {
      await session.send("Emulation.setSafeAreaInsetsOverride", {
        insets: {},
      });
    }
  });

  test("scrolls a long conversation and reaches its latest message", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-390",
      "single representative long-content run",
    );

    await page.goto("/?state=long");

    const log = page.getByRole("log", { name: "Cronologia dell'avventura" });
    const scrollViewport = log.locator(":scope > div").first();
    const latestParagraph = log.getByText(
      "Nessuno dei due percorsi sembra chiudersi alle vostre spalle",
      { exact: false },
    );

    await expectUsefulLogIntersection(log);
    await expect(scrollViewport).toHaveCSS("overflow-y", "auto");
    await expect
      .poll(() =>
        scrollViewport.evaluate(
          (element) => element.scrollHeight - element.clientHeight,
        ),
      )
      .toBeGreaterThan(1);

    const initialMetrics = await scrollViewport.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(initialMetrics.scrollHeight).toBeGreaterThan(
      initialMetrics.clientHeight + 1,
    );

    await scrollViewport.evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect
      .poll(() => scrollViewport.evaluate((element) => element.scrollTop))
      .toBeLessThanOrEqual(1);
    await expect(latestParagraph).not.toBeInViewport();

    await page
      .getByRole("button", { name: "Vai all'ultimo messaggio" })
      .click();
    await expect
      .poll(() =>
        scrollViewport.evaluate(
          (element) =>
            element.scrollHeight - element.clientHeight - element.scrollTop,
        ),
      )
      .toBeLessThanOrEqual(2);
    await expect(latestParagraph).toBeInViewport();
  });
});

test.describe("BL-079 keyboard and interaction contracts", () => {
  test("traps focus in the drawer, closes with Escape, and restores focus", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-390",
      "single representative keyboard run",
    );

    await openCompletedFixture(page);

    const trigger = page.getByTestId("game-menu");
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await trigger.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Dettagli avventura" });
    await expect(dialog).toBeVisible();
    await expectFocusInside(dialog);

    await page.keyboard.press("Tab");
    await expectFocusInside(dialog);
    await page.keyboard.press("Shift+Tab");
    await expectFocusInside(dialog);

    const scrollRegion = page.getByRole("region", {
      name: "Contenuto Dettagli avventura",
    });
    await scrollRegion.focus();
    const initialScrollTop = await scrollRegion.evaluate(
      (element) => element.scrollTop,
    );
    await page.keyboard.press("PageDown");
    await expect
      .poll(() => scrollRegion.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(initialScrollTop);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("submits with Enter and preserves a newline with Shift+Enter", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-390",
      "single representative composer run",
    );

    await openCompletedFixture(page);

    const input = page.getByRole("textbox", { name: "Scrivi la tua azione" });
    await input.fill("Resto in ascolto");
    await input.press("Shift+Enter");
    await input.type("prima di avanzare");

    await expect(input).toHaveValue("Resto in ascolto\nprima di avanzare");

    await input.press("Enter");
    await expect(page.getByTestId("fixture-notice")).toContainText(
      "Resto in ascolto",
    );
    await expect(page.getByTestId("fixture-notice")).toContainText(
      "prima di avanzare",
    );
    await expect(input).toHaveValue("");
  });
});

test.describe("BL-079 failure and reconnect states", () => {
  test("offers only a safe retry after a pre-commit failure", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-1024",
      "single representative state run",
    );

    await page.goto("/?state=error");

    const shell = page.getByTestId("game-shell");
    const input = page.getByRole("textbox", { name: "Scrivi la tua azione" });

    await expect(shell).toHaveAttribute("data-turn-state", "failed_precommit");
    await expect(page.getByTestId("safe-retry-banner")).toBeVisible();
    await expect(input).toBeEnabled();
    await expect(page.getByTestId("state-diff")).toHaveCount(0);

    await page.getByRole("button", { name: "Riprova in sicurezza" }).click();
    await expect(page.getByTestId("fixture-notice")).toContainText(
      "retry sicuro",
    );
  });

  test("communicates that state is saved while reconnecting without resubmission", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-1024",
      "single representative state run",
    );

    await page.goto("/?state=reconnect");

    const shell = page.getByTestId("game-shell");
    const connectionStatus = page.getByTestId("connection-status");

    await expect(shell).toHaveAttribute(
      "data-turn-state",
      "completed_with_delivery_error",
    );
    await expect(connectionStatus).toContainText("Riconnessione in corso");
    await expect(connectionStatus).toContainText("turno");
    await expect(
      page.getByRole("textbox", { name: "Scrivi la tua azione" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Azione in elaborazione" }),
    ).toBeDisabled();
    await expect(page.getByTestId("safe-retry-banner")).toHaveCount(0);
  });
});

test.describe("BL-079 accessibility and motion", () => {
  test("has no WCAG A/AA axe violations in representative shells", async ({
    page,
  }, testInfo) => {
    test.skip(
      !["mobile-390", "desktop-1440"].includes(testInfo.project.name),
      "representative mobile and desktop scans",
    );

    await openCompletedFixture(page);

    const results = await new AxeBuilder({ page })
      .include('[data-testid="game-shell"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(
      results.violations,
      results.violations
        .map(
          (violation) =>
            `${violation.id}: ${violation.help} (${violation.nodes.length} nodes)`,
        )
        .join("\n"),
    ).toEqual([]);

    if (testInfo.project.name === "mobile-390") {
      await page.getByTestId("game-menu").click();
      await expect(
        page.getByRole("dialog", { name: "Dettagli avventura" }),
      ).toBeVisible();

      const drawerResults = await new AxeBuilder({ page })
        .include('[data-slot="drawer-content"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();

      expect(
        drawerResults.violations,
        drawerResults.violations
          .map(
            (violation) =>
              `${violation.id}: ${violation.help} (${violation.nodes.length} nodes)`,
          )
          .join("\n"),
      ).toEqual([]);
    }
  });

  test("preserves content, actions, and focus with reduced motion", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-390",
      "single representative reduced-motion run",
    );

    const consoleProblems: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "warning" || message.type() === "error") {
        consoleProblems.push(`[${message.type()}] ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await openCompletedFixture(page);

    await expect
      .poll(() =>
        page.evaluate(
          () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        ),
      )
      .toBe(true);

    const action = page.getByRole("button", {
      name: "Esamino la sequenza senza toccarla",
    });
    const input = page.getByRole("textbox", { name: "Scrivi la tua azione" });

    await expect(
      page.getByRole("article", { name: "Dungeon Master" }),
    ).toBeVisible();
    await action.focus();
    await action.press("Enter");
    await expect(input).toHaveValue("Esamino la sequenza senza toccarla");
    await input.focus();
    await expect(input).toBeFocused();

    const hydrationProblems = [...consoleProblems, ...pageErrors].filter(
      (message) =>
        /hydration|hydrated|server-rendered html|did not match/i.test(message),
    );

    expect(
      hydrationProblems,
      "reduced-motion rendering must not produce a hydration mismatch",
    ).toEqual([]);
    expect(
      consoleProblems.filter((message) => message.startsWith("[error]")),
      "unexpected console error",
    ).toEqual([]);
    expect(pageErrors, "unexpected uncaught page error").toEqual([]);
  });
});

test.describe("BL-079 visual regression", () => {
  test("matches the completed shell baseline", async ({ page }, testInfo) => {
    test.skip(
      !visualBaselineProjects.has(testInfo.project.name),
      "representative visual viewport",
    );

    await page.emulateMedia({ reducedMotion: "reduce" });
    await openCompletedFixture(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot("completed-shell.png");
  });

  for (const state of ["loading", "error", "reconnect"] as const) {
    test(`matches the ${state} state baseline`, async ({ page }, testInfo) => {
      test.skip(
        testInfo.project.name !== "mobile-390",
        "representative state viewport",
      );

      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/?state=${state}`);
      await expect(page.getByTestId("game-shell")).toBeVisible();
      await waitForVisualStability(page);

      await expect(page).toHaveScreenshot(`${state}-shell.png`);
    });
  }
});
