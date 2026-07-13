export const expectedPerformancePhases = Object.freeze([
  "scroll-latest",
  "drawer-open",
  "drawer-close",
  "composer-submit",
]);

export const performanceBudget = Object.freeze({
  maximumBlockingDurationMs: 0,
  maximumCumulativeLayoutShift: 0.1,
  maximumEventProcessingTimeMs: 50,
  maximumInteractionDurationMs: 104,
});

function findPhase(entry, phases) {
  const entryEnd = entry.startTime + entry.duration;

  return (
    phases.find((phase) => {
      const phaseEnd = phase.startTime + phase.duration;

      return entry.startTime < phaseEnd && entryEnd > phase.startTime;
    })?.name ?? null
  );
}

function withPhase(entry, phases) {
  return {
    ...entry,
    phase: findPhase(entry, phases),
  };
}

export function evaluatePerformanceSample(sample) {
  const violations = [];
  const measuredEvents = sample.events
    .map((entry) => withPhase(entry, sample.phases))
    .filter((entry) => entry.phase !== null);
  const longAnimationFrames = sample.longAnimationFrames.map((entry) =>
    withPhase(entry, sample.phases),
  );
  const longTasks = sample.longTasks.map((entry) =>
    withPhase(entry, sample.phases),
  );
  const blockingEntries = sample.supportsLongAnimationFrames
    ? longAnimationFrames.filter(
        (entry) =>
          entry.phase !== null &&
          entry.blockingDuration > performanceBudget.maximumBlockingDurationMs,
      )
    : longTasks
        .filter((entry) => entry.phase !== null)
        .map((entry) => ({
          ...entry,
          blockingDuration: Math.max(0, entry.duration - 50),
        }))
        .filter(
          (entry) =>
            entry.blockingDuration >
            performanceBudget.maximumBlockingDurationMs,
        );

  for (const phase of expectedPerformancePhases) {
    if (!sample.phases.some((entry) => entry.name === phase)) {
      violations.push({ code: "phase-missing", phase });
    }

    if (!sample.inputs.some((entry) => entry.phase === phase)) {
      violations.push({ code: "input-missing", phase });
    }
  }

  if (!sample.supportsEventTiming) {
    violations.push({ code: "event-timing-unsupported" });
  }

  if (!sample.supportsLongAnimationFrames) {
    violations.push({ code: "long-animation-frame-unsupported" });
  }

  if (!sample.supportsLayoutShift) {
    violations.push({ code: "layout-shift-unsupported" });
  }

  if (sample.cls > performanceBudget.maximumCumulativeLayoutShift) {
    violations.push({
      actual: sample.cls,
      code: "cumulative-layout-shift",
      maximum: performanceBudget.maximumCumulativeLayoutShift,
    });
  }

  for (const entry of measuredEvents) {
    const processingDuration = entry.processingEnd - entry.processingStart;

    if (entry.duration > performanceBudget.maximumInteractionDurationMs) {
      violations.push({
        actual: entry.duration,
        code: "interaction-duration",
        maximum: performanceBudget.maximumInteractionDurationMs,
        phase: entry.phase,
      });
    }

    if (processingDuration >= performanceBudget.maximumEventProcessingTimeMs) {
      violations.push({
        actual: processingDuration,
        code: "event-processing-duration",
        maximumExclusive: performanceBudget.maximumEventProcessingTimeMs,
        phase: entry.phase,
      });
    }
  }

  for (const entry of blockingEntries) {
    violations.push({
      actual: entry.blockingDuration,
      code: "interaction-blocking-frame",
      maximum: performanceBudget.maximumBlockingDurationMs,
      phase: entry.phase,
    });
  }

  return {
    blockingEntries,
    longAnimationFrames,
    longTasks,
    measuredEvents,
    inputs: sample.inputs,
    passed: violations.length === 0,
    violations,
  };
}
