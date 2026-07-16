import assert from "node:assert/strict";
import test from "node:test";

import {
  createFakeClock,
  createFixtureFactory,
  createSeededRng,
  createTestId,
} from "../../packages/testing/dist/index.js";

test("QA-001:test-id-validates-task-and-case-slug", () => {
  assert.equal(
    createTestId("QA-001", "seeded-rng-golden-sequence"),
    "QA-001:seeded-rng-golden-sequence",
  );
  assert.equal(
    createTestId("DOC-ARCH-001", "documented-boundary"),
    "DOC-ARCH-001:documented-boundary",
  );

  for (const [taskId, caseSlug] of [
    ["qa-001", "valid-slug"],
    ["QA", "valid-slug"],
    ["QA-001", ""],
    ["QA-001", "Invalid Slug"],
    ["QA-001", "invalid_slug"],
  ]) {
    assert.throws(
      () => createTestId(taskId, caseSlug),
      /testing: invalid-test-id/u,
    );
  }
});
test("QA-001:seeded-rng-has-a-stable-golden-sequence", () => {
  const first = createSeededRng(0x12345678);
  const second = createSeededRng(0x12345678);
  const expected = [
    0.529668488772586, 0.08342198352329433, 0.28175287041813135,
    0.5066478606313467, 0.43838545866310596,
  ];

  assert.deepEqual(
    Array.from({ length: expected.length }, () => first.next()),
    expected,
  );
  assert.deepEqual(
    Array.from({ length: expected.length }, () => second.next()),
    expected,
  );
  assert.deepEqual(first.snapshot(), {
    algorithm: "xorshift32-v1",
    state: 1882851208,
  });
  assert.equal(Object.isFrozen(first.snapshot()), true);
});

test("QA-001:seeded-rng-validates-seeds-and-inclusive-integer-ranges", () => {
  assert.throws(() => createSeededRng(0), /testing: invalid-rng-seed/u);
  assert.throws(() => createSeededRng(-1), /testing: invalid-rng-seed/u);
  assert.throws(() => createSeededRng(2 ** 32), /testing: invalid-rng-seed/u);

  const rng = createSeededRng(1);
  for (const invalidRange of [
    { min: 2, max: 1 },
    { min: 1.5, max: 2 },
    { min: 0, max: Number.MAX_SAFE_INTEGER },
  ]) {
    assert.throws(
      () => rng.integer(invalidRange),
      /testing: invalid-rng-range/u,
    );
  }

  const values = Array.from({ length: 100 }, () =>
    rng.integer({ min: 2, max: 4 }),
  );
  assert.ok(values.every((value) => value >= 2 && value <= 4));
  assert.deepEqual([...new Set(values)].sort(), [2, 3, 4]);
});

test("QA-001:fake-clock-is-explicit-and-monotonic", () => {
  const clock = createFakeClock("2026-07-16T00:00:00.000Z");

  assert.equal(clock.nowMs(), Date.parse("2026-07-16T00:00:00.000Z"));
  const detached = clock.now();
  detached.setUTCFullYear(2030);
  assert.equal(clock.now().toISOString(), "2026-07-16T00:00:00.000Z");

  clock.advanceBy(1_000);
  assert.equal(clock.now().toISOString(), "2026-07-16T00:00:01.000Z");
  clock.set(new Date("2026-07-16T00:00:02.000Z"));
  assert.equal(clock.now().toISOString(), "2026-07-16T00:00:02.000Z");

  for (const invalidAdvance of [-1, 0.5, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => clock.advanceBy(invalidAdvance),
      /testing: invalid-clock-advance/u,
    );
  }
  assert.throws(
    () => clock.set("2026-07-16T00:00:01.999Z"),
    /testing: non-monotonic-clock/u,
  );
  assert.throws(
    () => createFakeClock("not-an-instant"),
    /testing: invalid-clock-instant/u,
  );
});

test("QA-001:fixture-factory-returns-detached-validated-values", () => {
  const factory = createFixtureFactory({
    base: () => ({
      name: "base",
      nested: { tags: ["initial"] },
    }),
    parse(candidate) {
      assert.equal(typeof candidate?.name, "string");
      assert.notEqual(candidate.name.trim(), "");
      assert.ok(Array.isArray(candidate?.nested?.tags));
      return candidate;
    },
  });

  const first = factory({ name: "hero" });
  assert.deepEqual(first, {
    name: "hero",
    nested: { tags: ["initial"] },
  });
  first.nested.tags.push("mutated");

  assert.deepEqual(factory(), {
    name: "base",
    nested: { tags: ["initial"] },
  });
  assert.throws(() => factory({ name: " " }), assert.AssertionError);
});
