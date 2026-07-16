const UINT32_RANGE = 0x1_0000_0000;
const MAX_UINT32 = UINT32_RANGE - 1;

export interface SeededRng {
  next(): number;
  integer(range: Readonly<{ min: number; max: number }>): number;
  snapshot(): Readonly<{
    algorithm: "xorshift32-v1";
    state: number;
  }>;
}
function isValidSeed(seed: number): boolean {
  return Number.isInteger(seed) && seed >= 1 && seed <= MAX_UINT32;
}

export function createSeededRng(seed: number): SeededRng {
  if (!isValidSeed(seed)) {
    throw new Error("testing: invalid-rng-seed");
  }

  let state = seed >>> 0;

  function next(): number {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / UINT32_RANGE;
  }

  function integer({ min, max }: Readonly<{ min: number; max: number }>): number {
    const span = max - min + 1;

    if (
      !Number.isSafeInteger(min) ||
      !Number.isSafeInteger(max) ||
      min > max ||
      !Number.isSafeInteger(span) ||
      span < 1 ||
      span > UINT32_RANGE
    ) {
      throw new Error("testing: invalid-rng-range");
    }

    return min + Math.floor(next() * span);
  }

  return Object.freeze({
    integer,
    next,
    snapshot: () =>
      Object.freeze({
        algorithm: "xorshift32-v1" as const,
        state,
      }),
  });
}
