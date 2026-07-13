import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluatePerformanceSample,
  expectedPerformancePhases,
} from "../../apps/web/e2e/performance-budget.mjs";

function phases() {
  return expectedPerformancePhases.map((name, index) => ({
    duration: 20,
    name,
    startTime: 200 + index * 30,
  }));
}

function validSample() {
  return {
    cls: 0.1,
    events: [
      {
        duration: 104,
        interactionId: 1,
        name: "click",
        processingEnd: 249.9,
        processingStart: 200,
        startTime: 200,
      },
    ],
    inputs: expectedPerformancePhases.map((phase, index) => ({
      name: phase === "composer-submit" ? "keydown" : "click",
      phase,
      startTime: 205 + index * 30,
    })),
    longAnimationFrames: [
      {
        blockingDuration: 0,
        duration: 60,
        scripts: [],
        startTime: 190,
      },
    ],
    longTasks: [],
    phases: phases(),
    supportsEventTiming: true,
    supportsLayoutShift: true,
    supportsLongAnimationFrames: true,
  };
}

test("the premium interaction budget accepts every documented boundary", () => {
  const result = evaluatePerformanceSample(validSample());

  assert.equal(result.passed, true);
  assert.deepEqual(result.violations, []);
  assert.equal(result.blockingEntries.length, 0);
});

test("slow event processing, blocking frames and excessive CLS fail closed", () => {
  const sample = validSample();
  sample.cls = 0.101;
  sample.events[0].duration = 112;
  sample.events[0].processingEnd = 250;
  sample.longAnimationFrames[0].blockingDuration = 8;
  const result = evaluatePerformanceSample(sample);
  const codes = new Set(result.violations.map(({ code }) => code));

  assert.equal(result.passed, false);
  assert.deepEqual(
    codes,
    new Set([
      "cumulative-layout-shift",
      "event-processing-duration",
      "interaction-blocking-frame",
      "interaction-duration",
    ]),
  );
});

test("expensive browser work outside measured interactions stays diagnostic", () => {
  const sample = validSample();
  sample.longAnimationFrames = [
    {
      blockingDuration: 70,
      duration: 120,
      scripts: [],
      startTime: 10,
    },
  ];
  sample.longTasks = [{ duration: 120, startTime: 10 }];
  const result = evaluatePerformanceSample(sample);

  assert.equal(result.passed, true);
  assert.equal(result.blockingEntries.length, 0);
  assert.equal(result.longAnimationFrames[0].phase, null);
  assert.equal(result.longTasks[0].phase, null);
});

test("every named phase must contain a captured user input", () => {
  const sample = validSample();
  sample.inputs = sample.inputs.filter(
    ({ phase }) => phase !== "composer-submit",
  );
  const result = evaluatePerformanceSample(sample);

  assert.equal(result.passed, false);
  assert.deepEqual(
    result.violations.filter(({ code }) => code === "input-missing"),
    [{ code: "input-missing", phase: "composer-submit" }],
  );
});
