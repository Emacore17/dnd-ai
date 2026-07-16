export interface FakeClock {
  now(): Date;
  nowMs(): number;
  advanceBy(milliseconds: number): void;
  set(instant: string | Date): void;
}
function parseInstant(instant: string | Date): number {
  const milliseconds =
    instant instanceof Date ? instant.getTime() : Date.parse(instant);

  if (!Number.isFinite(milliseconds)) {
    throw new Error("testing: invalid-clock-instant");
  }

  return milliseconds;
}

export function createFakeClock(initial: string | Date): FakeClock {
  let currentMilliseconds = parseInstant(initial);

  return Object.freeze({
    advanceBy(milliseconds: number): void {
      if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
        throw new Error("testing: invalid-clock-advance");
      }

      const nextMilliseconds = currentMilliseconds + milliseconds;
      if (!Number.isSafeInteger(nextMilliseconds)) {
        throw new Error("testing: invalid-clock-advance");
      }

      currentMilliseconds = nextMilliseconds;
    },
    now: () => new Date(currentMilliseconds),
    nowMs: () => currentMilliseconds,
    set(instant: string | Date): void {
      const nextMilliseconds = parseInstant(instant);

      if (nextMilliseconds < currentMilliseconds) {
        throw new Error("testing: non-monotonic-clock");
      }

      currentMilliseconds = nextMilliseconds;
    },
  });
}
