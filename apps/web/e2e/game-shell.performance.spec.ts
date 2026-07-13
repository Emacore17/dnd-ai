import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

import {
  evaluatePerformanceSample,
  performanceBudget,
} from "./performance-budget.mjs";

type PerformancePhaseName =
  "scroll-latest" | "drawer-open" | "drawer-close" | "composer-submit";

type PerformanceSample = Parameters<typeof evaluatePerformanceSample>[0];

async function waitForQuietWindow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter((animation) => animation.playState === "running").length,
      ),
    )
    .toBe(0);

  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

async function waitForScrollToSettle(scrollViewport: Locator) {
  const result = await scrollViewport.evaluate(
    (element) =>
      new Promise<{ distanceFromBottom: number; settled: boolean }>(
        (resolve) => {
          const maximumFrames = 180;
          const requiredStableFrames = 3;
          let frameCount = 0;
          let previousScrollTop = element.scrollTop;
          let stableFrames = 0;

          const sample = () => {
            const scrollTop = element.scrollTop;
            const distanceFromBottom = Math.abs(
              element.scrollHeight - element.clientHeight - scrollTop,
            );
            const positionIsStable =
              Math.abs(scrollTop - previousScrollTop) <= 0.5;

            stableFrames =
              distanceFromBottom <= 1 && positionIsStable
                ? stableFrames + 1
                : 0;
            frameCount += 1;
            previousScrollTop = scrollTop;

            if (stableFrames >= requiredStableFrames) {
              resolve({ distanceFromBottom, settled: true });
            } else if (frameCount >= maximumFrames) {
              resolve({ distanceFromBottom, settled: false });
            } else {
              requestAnimationFrame(sample);
            }
          };

          requestAnimationFrame(sample);
        },
      ),
  );

  expect(
    result.settled,
    "smooth feed scroll must settle inside its phase",
  ).toBe(true);
  expect(result.distanceFromBottom).toBeLessThanOrEqual(1);
}

async function installPerformanceRecorder(page: Page) {
  await page.evaluate(() => {
    type EventTimingEntry = PerformanceEntry & {
      interactionId: number;
      processingEnd: number;
      processingStart: number;
    };
    type LayoutShiftEntry = PerformanceEntry & {
      hadRecentInput: boolean;
      value: number;
    };
    type LongAnimationFrameEntry = PerformanceEntry & {
      blockingDuration: number;
      renderStart: number;
      scripts?: ArrayLike<
        PerformanceEntry & {
          executionStart?: number;
          forcedStyleAndLayoutDuration?: number;
          invokerType?: string;
          pauseDuration?: number;
          sourceFunctionName?: string;
        }
      >;
      styleAndLayoutStart: number;
    };
    type LongTaskEntry = PerformanceEntry & {
      attribution?: ArrayLike<
        PerformanceEntry & {
          containerId?: string;
          containerName?: string;
          containerType?: string;
        }
      >;
    };
    type RecorderState = {
      cls: number;
      events: Array<{
        duration: number;
        interactionId: number;
        name: string;
        processingEnd: number;
        processingStart: number;
        startTime: number;
      }>;
      inputs: Array<{
        name: string;
        phase: string;
        startTime: number;
      }>;
      layoutShifts: Array<{
        hadRecentInput: boolean;
        startTime: number;
        value: number;
      }>;
      longAnimationFrames: Array<{
        blockingDuration: number;
        duration: number;
        renderStart: number;
        scripts: Array<{
          duration: number;
          executionStart: number | null;
          forcedStyleAndLayoutDuration: number | null;
          invokerType: string | null;
          pauseDuration: number | null;
          sourceFunctionName: string | null;
          startTime: number;
        }>;
        startTime: number;
        styleAndLayoutStart: number;
      }>;
      longTasks: Array<{
        attribution: Array<{
          containerId: string | null;
          containerName: string | null;
          containerType: string | null;
          duration: number;
          name: string;
          startTime: number;
        }>;
        duration: number;
        startTime: number;
      }>;
      phases: Array<{
        duration: number;
        name: string;
        startTime: number;
      }>;
      supportsEventTiming: boolean;
      supportsLayoutShift: boolean;
      supportsLongAnimationFrames: boolean;
    };
    type RecorderWindow = typeof window & {
      __bl079PerformanceRecorder?: {
        endPhase: (name: string) => void;
        finish: () => RecorderState;
        startPhase: (name: string) => void;
      };
    };

    const supportedEntryTypes = PerformanceObserver.supportedEntryTypes;
    const state: RecorderState = {
      cls: 0,
      events: [],
      inputs: [],
      layoutShifts: [],
      longAnimationFrames: [],
      longTasks: [],
      phases: [],
      supportsEventTiming: supportedEntryTypes.includes("event"),
      supportsLayoutShift: supportedEntryTypes.includes("layout-shift"),
      supportsLongAnimationFrames: supportedEntryTypes.includes(
        "long-animation-frame",
      ),
    };
    const observers: PerformanceObserver[] = [];
    let activePhase: string | null = null;
    const inputEventTypes = ["click", "keydown"] as const;
    const collectInputEvent = (event: Event) => {
      if (activePhase === null) {
        return;
      }

      state.inputs.push({
        name: event.type,
        phase: activePhase,
        startTime: performance.now(),
      });
    };

    for (const eventType of inputEventTypes) {
      document.addEventListener(eventType, collectInputEvent, true);
    }

    const collectEventEntries = (entries: PerformanceEntry[]) => {
      for (const entry of entries) {
        const event = entry as EventTimingEntry;

        if (event.interactionId === 0) {
          continue;
        }

        state.events.push({
          duration: event.duration,
          interactionId: event.interactionId,
          name: event.name,
          processingEnd: event.processingEnd,
          processingStart: event.processingStart,
          startTime: event.startTime,
        });
      }
    };
    const collectLayoutShiftEntries = (entries: PerformanceEntry[]) => {
      for (const entry of entries) {
        const shift = entry as LayoutShiftEntry;
        state.layoutShifts.push({
          hadRecentInput: shift.hadRecentInput,
          startTime: shift.startTime,
          value: shift.value,
        });

        if (!shift.hadRecentInput) {
          state.cls += shift.value;
        }
      }
    };
    const collectLongAnimationFrameEntries = (entries: PerformanceEntry[]) => {
      for (const entry of entries) {
        const frame = entry as LongAnimationFrameEntry;
        state.longAnimationFrames.push({
          blockingDuration: frame.blockingDuration,
          duration: frame.duration,
          renderStart: frame.renderStart,
          scripts: Array.from(frame.scripts ?? []).map((script) => ({
            duration: script.duration,
            executionStart: script.executionStart ?? null,
            forcedStyleAndLayoutDuration:
              script.forcedStyleAndLayoutDuration ?? null,
            invokerType: script.invokerType ?? null,
            pauseDuration: script.pauseDuration ?? null,
            sourceFunctionName: script.sourceFunctionName ?? null,
            startTime: script.startTime,
          })),
          startTime: frame.startTime,
          styleAndLayoutStart: frame.styleAndLayoutStart,
        });
      }
    };
    const collectLongTaskEntries = (entries: PerformanceEntry[]) => {
      for (const entry of entries) {
        const task = entry as LongTaskEntry;
        state.longTasks.push({
          attribution: Array.from(task.attribution ?? []).map(
            (attribution) => ({
              containerId: attribution.containerId ?? null,
              containerName: attribution.containerName ?? null,
              containerType: attribution.containerType ?? null,
              duration: attribution.duration,
              name: attribution.name,
              startTime: attribution.startTime,
            }),
          ),
          duration: task.duration,
          startTime: task.startTime,
        });
      }
    };
    const observe = (
      type: string,
      collect: (entries: PerformanceEntry[]) => void,
      options: PerformanceObserverInit = { type },
    ) => {
      const observer = new PerformanceObserver((list) => {
        collect(list.getEntries());
      });
      observer.observe(options);
      observers.push(observer);
    };

    if (state.supportsEventTiming) {
      observe("event", collectEventEntries, {
        durationThreshold: 16,
        type: "event",
      } as PerformanceObserverInit);
    }

    if (state.supportsLayoutShift) {
      observe("layout-shift", collectLayoutShiftEntries);
    }

    if (state.supportsLongAnimationFrames) {
      observe("long-animation-frame", collectLongAnimationFrameEntries);
    }

    if (supportedEntryTypes.includes("longtask")) {
      observe("longtask", collectLongTaskEntries);
    }

    (window as RecorderWindow).__bl079PerformanceRecorder = {
      endPhase(name) {
        const startMark = `bl079:${name}:start`;
        const endMark = `bl079:${name}:end`;
        performance.mark(endMark);
        const measure = performance.measure(
          `bl079:${name}`,
          startMark,
          endMark,
        );
        state.phases.push({
          duration: measure.duration,
          name,
          startTime: measure.startTime,
        });
        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
        performance.clearMeasures(`bl079:${name}`);
        activePhase = null;
      },
      finish() {
        for (const observer of observers) {
          const entries = observer.takeRecords();

          if (entries.length > 0) {
            const type = entries[0]?.entryType;

            if (type === "event") {
              collectEventEntries(entries);
            } else if (type === "layout-shift") {
              collectLayoutShiftEntries(entries);
            } else if (type === "long-animation-frame") {
              collectLongAnimationFrameEntries(entries);
            } else if (type === "longtask") {
              collectLongTaskEntries(entries);
            }
          }

          observer.disconnect();
        }

        for (const eventType of inputEventTypes) {
          document.removeEventListener(eventType, collectInputEvent, true);
        }

        return state;
      },
      startPhase(name) {
        activePhase = name;
        performance.mark(`bl079:${name}:start`);
      },
    };
  });
}

async function runMeasuredPhase(
  page: Page,
  name: PerformancePhaseName,
  action: () => Promise<void>,
) {
  await test.step(name, async () => {
    await page.evaluate((phaseName) => {
      const performanceWindow = window as typeof window & {
        __bl079PerformanceRecorder?: {
          startPhase: (name: string) => void;
        };
      };
      performanceWindow.__bl079PerformanceRecorder?.startPhase(phaseName);
    }, name);

    try {
      await action();
      await waitForQuietWindow(page);
    } finally {
      await page.evaluate((phaseName) => {
        const performanceWindow = window as typeof window & {
          __bl079PerformanceRecorder?: {
            endPhase: (name: string) => void;
          };
        };
        performanceWindow.__bl079PerformanceRecorder?.endPhase(phaseName);
      }, name);
    }
  });
}

async function attachPerformanceDiagnostics(
  sample: PerformanceSample,
  testInfo: TestInfo,
) {
  const evaluation = evaluatePerformanceSample(sample);

  await testInfo.attach("performance-smoke.json", {
    body: JSON.stringify(
      { budget: performanceBudget, evaluation, sample },
      null,
      2,
    ),
    contentType: "application/json",
  });

  return evaluation;
}

test("keeps production mobile interactions within the premium budget", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-390",
    "single representative mobile performance trace",
  );

  await page.goto("/?state=long");
  await expect(page.getByTestId("game-shell")).toHaveAttribute(
    "data-turn-state",
    "completed",
  );
  await page.evaluate(() => document.fonts.ready);
  await waitForQuietWindow(page);

  const conversation = page.getByRole("log");
  const scrollViewport = conversation.locator(":scope > div").first();
  await scrollViewport.evaluate((element) => {
    element.scrollTo({ behavior: "instant", top: 0 });
  });
  await expect
    .poll(() => scrollViewport.evaluate((element) => element.scrollTop))
    .toBeLessThanOrEqual(1);

  await installPerformanceRecorder(page);

  await runMeasuredPhase(page, "scroll-latest", async () => {
    await page
      .getByRole("button", { name: "Vai all'ultimo messaggio" })
      .click();
    await waitForScrollToSettle(scrollViewport);
  });

  const objectiveDrawer = page.getByRole("dialog", { name: "Obiettivo" });
  await runMeasuredPhase(page, "drawer-open", async () => {
    await page.getByTestId("hud-objective").click();
    await expect(objectiveDrawer).toBeVisible();
  });
  await runMeasuredPhase(page, "drawer-close", async () => {
    await page.getByRole("button", { name: "Chiudi Obiettivo" }).click();
    await expect(objectiveDrawer).not.toBeVisible();
  });

  const composer = page.getByRole("textbox", {
    name: "Scrivi la tua azione",
  });
  await composer.fill("Controllo il passaggio laterale");
  await runMeasuredPhase(page, "composer-submit", async () => {
    await composer.press("Enter");
    await expect(page.getByTestId("fixture-notice")).toBeVisible();
  });

  const sample = await page.evaluate(() => {
    const performanceWindow = window as typeof window & {
      __bl079PerformanceRecorder?: {
        finish: () => PerformanceSample;
      };
    };

    return performanceWindow.__bl079PerformanceRecorder?.finish();
  });

  expect(sample, "performance recorder must be initialized").toBeDefined();

  if (!sample) {
    return;
  }

  const evaluation = await attachPerformanceDiagnostics(sample, testInfo);

  expect(sample.supportsEventTiming, "Event Timing must be available").toBe(
    true,
  );
  expect(sample.supportsLongAnimationFrames, "LoAF must be available").toBe(
    true,
  );
  expect(sample.supportsLayoutShift, "Layout Shift must be available").toBe(
    true,
  );
  expect(
    evaluation.violations,
    "premium interaction budget violations",
  ).toEqual([]);
});
