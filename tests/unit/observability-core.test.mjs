import assert from "node:assert/strict";
import test from "node:test";

import {
  createNoopErrorReporter,
  createRequestId,
} from "../../packages/observability/dist/index.js";

const validRequestId = "6f9619ff-8b86-4a5d-9f6d-8f6f3e9f4a31";
const generatedRequestId = "550e8400-e29b-41d4-a716-446655440000";

test("createRequestId preserves a canonical lowercase UUID v4", () => {
  let generatorCalls = 0;

  assert.equal(
    createRequestId(validRequestId, () => {
      generatorCalls += 1;
      return generatedRequestId;
    }),
    validRequestId,
  );
  assert.equal(generatorCalls, 0);
});

test("createRequestId replaces absent and non-canonical candidates", () => {
  const invalidCandidates = [
    undefined,
    validRequestId.toUpperCase(),
    "6f9619ff-8b86-1a5d-9f6d-8f6f3e9f4a31",
    "6f9619ff-8b86-4a5d-7f6d-8f6f3e9f4a31",
    "not-a-request-id",
  ];

  for (const candidate of invalidCandidates) {
    assert.equal(
      createRequestId(candidate, () => generatedRequestId),
      generatedRequestId,
    );
  }
});

test("createRequestId rejects invalid generator output without reflecting it", () => {
  const sensitiveGeneratorOutput = "invalid-secret-request-id";

  assert.throws(
    () => createRequestId(undefined, () => sensitiveGeneratorOutput),
    (error) => {
      assert.equal(error instanceof Error, true);
      assert.equal(error.message, "Unable to generate a valid request ID.");
      assert.doesNotMatch(error.message, new RegExp(sensitiveGeneratorOutput));
      return true;
    },
  );
});

test("createNoopErrorReporter returns one frozen reporter whose capture never throws", () => {
  const reporter = createNoopErrorReporter();

  assert.equal(reporter, createNoopErrorReporter());
  assert.equal(Object.isFrozen(reporter), true);

  for (const value of [
    undefined,
    null,
    "sensitive failure",
    new Error("sensitive failure"),
    Object.freeze({ reason: "sensitive failure" }),
  ]) {
    assert.doesNotThrow(() => reporter.capture(value));
  }
});

test("no-op reporter flush resolves true and rejects invalid timeouts safely", async () => {
  const reporter = createNoopErrorReporter();

  await assert.doesNotReject(() => reporter.flush(0));
  assert.equal(await reporter.flush(25), true);

  for (const timeoutMs of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    await assert.rejects(reporter.flush(timeoutMs), (error) => {
      assert.equal(error instanceof Error, true);
      assert.equal(
        error.message,
        "Error reporter flush timeout must be a finite non-negative number.",
      );
      assert.doesNotMatch(error.message, new RegExp(String(timeoutMs)));
      return true;
    });
  }
});
