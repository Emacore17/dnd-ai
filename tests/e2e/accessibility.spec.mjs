import {
  analyzeAccessibility,
  assertNoAccessibilityBlockers,
  expect,
  expectNoHorizontalOverflow,
  openGameShell,
  test,
} from "./browser-fixture.mjs";

test.describe("accessible phone shell", () => {
  test.use({ viewport: { height: 844, width: 390 } });

  test("QA-002: shell has no automated A or AA blockers", async ({ page }) => {
    await openGameShell(page);
    assertNoAccessibilityBlockers(await analyzeAccessibility(page));
  });

  test("QA-002: axe blocks an intentional violation", async ({ page }) => {
    await page.setContent("<main><button></button></main>");
    const result = await analyzeAccessibility(page);

    expect(result.violations.some(({ id }) => id === "button-name")).toBe(true);
    expect(() => assertNoAccessibilityBlockers(result)).toThrow(/button-name/u);
  });

  test("QA-002: keyboard order and Escape restore the HUD trigger", async ({
    page,
  }) => {
    await openGameShell(page);
    const sequence = [
      page.getByRole("button", { name: "Segui il segnale" }),
      page.getByRole("button", { name: "Resta con Mara" }),
      page.getByRole("button", { name: "Altre opzioni" }),
      page.getByRole("textbox", { name: "Descrivi la tua azione" }),
      page.getByRole("button", { name: "Apri obiettivo" }),
    ];

    await sequence[0].focus();
    await expect(sequence[0]).toBeFocused();
    for (const target of sequence.slice(1)) {
      await page.keyboard.press("Tab");
      await expect(target).toBeFocused();
    }

    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sequence.at(-1)).toBeFocused();
  });

  test("QA-002: simulated safe area keeps composer and HUD reachable", async ({
    page,
  }) => {
    await openGameShell(page);
    await page.evaluate(() =>
      globalThis.document.documentElement.style.setProperty(
        "--safe-area-bottom",
        "34px",
      ),
    );

    const footer = page.locator("footer");
    const paddingBottom = await footer.evaluate((element) =>
      Number.parseFloat(globalThis.getComputedStyle(element).paddingBottom),
    );
    expect(paddingBottom).toBeGreaterThanOrEqual(34);
    await expect(
      page.getByRole("textbox", { name: "Descrivi la tua azione" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "HUD dell'avventura" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("200 percent zoom", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("QA-002: zoom keeps the primary controls visible", async ({ page }) => {
    await openGameShell(page);
    await page.evaluate(() => {
      globalThis.document.documentElement.style.zoom = "2";
    });

    await expect(
      page.getByRole("textbox", { name: "Descrivi la tua azione" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Invia azione" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "HUD dell'avventura" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("reduced motion", () => {
  test.use({ viewport: { height: 844, width: 390 } });

  test("QA-002: reduced motion preserves complete turn information", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const shell = await openGameShell(page);
    expect(
      await page.evaluate(
        () => globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    ).toBe(true);

    await page.getByRole("button", { name: "Segui il segnale" }).click();
    await expect(shell).toHaveAttribute("data-shell-status", "completed");
    await expect(
      page.getByText("Obiettivo e posizione aggiornati."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Continua" })).toBeVisible();
  });
});
