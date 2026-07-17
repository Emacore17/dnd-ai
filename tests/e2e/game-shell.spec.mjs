import {
  expect,
  expectMinimumTarget,
  expectNoHorizontalOverflow,
  openGameShell,
  test,
} from "./browser-fixture.mjs";

async function expectCoreShell(page) {
  await expect(
    page.getByRole("heading", { name: "Passaggio di servizio" }),
  ).toBeVisible();
  await expect(
    page.getByRole("log", { name: "Cronologia dell'avventura" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Descrivi la tua azione" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "HUD dell'avventura" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await expectMinimumTarget(
    page.getByRole("button", { name: "Segui il segnale" }),
    44,
    "suggested action",
  );
  await expectMinimumTarget(
    page.getByRole("button", { name: "Invia azione" }),
    48,
    "primary send action",
  );
}

test.describe("320 px compact mobile shell", () => {
  test.use({ viewport: { height: 800, width: 320 } });

  test("QA-002: compact mobile shell remains usable", async ({ page }) => {
    await openGameShell(page);
    await expectCoreShell(page);
  });
});

test.describe("390 px touch shell", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    screen: { height: 844, width: 390 },
    viewport: { height: 844, width: 390 },
  });

  test("QA-002: touch action completes without duplicate input", async ({
    page,
  }) => {
    const shell = await openGameShell(page);
    await expectCoreShell(page);

    const action = page.getByRole("button", { name: "Segui il segnale" });
    const box = await action.boundingBox();
    expect(box, "touch target size box").not.toBeNull();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

    await expect(shell).toHaveAttribute("data-shell-status", "completed");
    await expect(
      page.getByText("Segui il segnale", { exact: true }),
    ).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("1440 px desktop shell", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("QA-002: desktop shell preserves hierarchy and focus restore", async ({
    page,
  }) => {
    await openGameShell(page);
    await expectCoreShell(page);

    const objective = page.getByRole("button", { name: "Apri obiettivo" });
    await objective.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Chiudi dettagli" }).click();
    await expect(
      objective,
      "focus restore after closing the HUD drawer",
    ).toBeFocused();
  });
});
