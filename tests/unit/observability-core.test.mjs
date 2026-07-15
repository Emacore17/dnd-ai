import assert from "node:assert/strict";
import test from "node:test";

import {
  createNoopErrorReporter,
  createRequestId,
  sanitizeTelemetryValue,
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

test("createRequestId rejects coercible runtime outputs without invoking coercion", () => {
  const coercionSecret = "sensitive-coercion-failure";
  const invalidRuntimeOutputs = [
    Object(generatedRequestId),
    [generatedRequestId],
    {
      [Symbol.toPrimitive]() {
        throw new Error(coercionSecret);
      },
    },
  ];

  for (const output of invalidRuntimeOutputs) {
    assert.throws(
      () => createRequestId(undefined, () => output),
      (error) => {
        assert.equal(error instanceof Error, true);
        assert.equal(error.message, "Unable to generate a valid request ID.");
        assert.doesNotMatch(error.message, new RegExp(coercionSecret));
        return true;
      },
    );
  }
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

test("sanitizeTelemetryValue returns a detached deterministic JSON-safe value", () => {
  const input = {
    zeta: {
      finite: 42,
      nested: [true, null, "safe"],
    },
    alpha: "value",
    ignored: undefined,
  };

  const sanitized = sanitizeTelemetryValue(input);

  assert.deepEqual(sanitized, {
    alpha: "value",
    ignored: "[REDACTED]",
    zeta: {
      finite: 42,
      nested: [true, null, "safe"],
    },
  });
  assert.notEqual(sanitized, input);
  assert.notEqual(sanitized.zeta, input.zeta);
  assert.doesNotThrow(() => JSON.stringify(sanitized));

  sanitized.zeta.nested[2] = "changed";
  assert.equal(input.zeta.nested[2], "safe");
});

test("sanitizeTelemetryValue redacts sensitive keys and sensitive string values", () => {
  const sensitiveKeys = [
    "Authorization",
    "cookie",
    "SET-COOKIE",
    "password",
    "PASSWD",
    "token",
    "apiKey",
    "API_KEY",
    "dsn",
    "body",
    "request",
    "response",
    "prompt",
    "narration",
    "output",
    "tool",
    "chainOfThought",
    "user",
    "headers",
    "extra",
  ];
  const input = Object.fromEntries(
    sensitiveKeys.map((key) => [key, { nested: "secret" }]),
  );
  input.emailValue = "player@example.test";
  input.credentialUrl = "https://player:secret@example.test/campaign";
  input.safeUrl = "https://example.test/campaign";

  assert.deepEqual(sanitizeTelemetryValue(input), {
    API_KEY: "[REDACTED]",
    Authorization: "[REDACTED]",
    PASSWD: "[REDACTED]",
    "SET-COOKIE": "[REDACTED]",
    apiKey: "[REDACTED]",
    body: "[REDACTED]",
    chainOfThought: "[REDACTED]",
    cookie: "[REDACTED]",
    credentialUrl: "[REDACTED]",
    dsn: "[REDACTED]",
    emailValue: "[REDACTED]",
    extra: "[REDACTED]",
    headers: "[REDACTED]",
    narration: "[REDACTED]",
    output: "[REDACTED]",
    password: "[REDACTED]",
    prompt: "[REDACTED]",
    request: "[REDACTED]",
    response: "[REDACTED]",
    safeUrl: "https://example.test/campaign",
    token: "[REDACTED]",
    tool: "[REDACTED]",
    user: "[REDACTED]",
  });
});

test("sanitizeTelemetryValue enforces depth and collection limits without invoking getters", () => {
  let getterCalls = 0;
  const input = {};

  Object.defineProperty(input, "getter", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "secret";
    },
  });

  for (let index = 39; index >= 0; index -= 1) {
    input[`key-${String(index).padStart(2, "0")}`] = index;
  }

  const longString = "x".repeat(600);
  const longArray = Array.from({ length: 40 }, (_, index) => index);
  const nested = { level: 0 };
  let cursor = nested;

  for (let level = 1; level <= 7; level += 1) {
    cursor.child = { level };
    cursor = cursor.child;
  }

  const sanitizedObject = sanitizeTelemetryValue(input);

  assert.equal(getterCalls, 0);
  assert.equal(Object.hasOwn(sanitizedObject, "getter"), false);
  assert.deepEqual(
    Object.keys(sanitizedObject),
    Array.from(
      { length: 32 },
      (_, index) => `key-${String(index).padStart(2, "0")}`,
    ),
  );
  assert.equal(sanitizeTelemetryValue(longString), "x".repeat(512));
  assert.deepEqual(
    sanitizeTelemetryValue(longArray),
    Array.from({ length: 32 }, (_, index) => index),
  );
  assert.deepEqual(sanitizeTelemetryValue(nested), {
    child: {
      child: {
        child: {
          child: {
            child: {
              child: "[REDACTED]",
              level: 5,
            },
            level: 4,
          },
          level: 3,
        },
        level: 2,
      },
      level: 1,
    },
    level: 0,
  });
});

test("sanitizeTelemetryValue safely redacts cycles and unsupported runtime values", () => {
  const input = {
    bigint: 1n,
    date: new Date("2026-07-15T00:00:00.000Z"),
    error: new Error("secret"),
    fn() {},
    infinity: Number.POSITIVE_INFINITY,
    map: new Map([["secret", "value"]]),
    nan: Number.NaN,
    regexp: /secret/u,
    set: new Set(["secret"]),
    symbol: Symbol("secret"),
  };
  input.self = input;

  const sanitized = sanitizeTelemetryValue(input);

  assert.deepEqual(sanitized, {
    bigint: "[REDACTED]",
    date: "[REDACTED]",
    error: "[REDACTED]",
    fn: "[REDACTED]",
    infinity: "[REDACTED]",
    map: "[REDACTED]",
    nan: "[REDACTED]",
    regexp: "[REDACTED]",
    self: "[REDACTED]",
    set: "[REDACTED]",
    symbol: "[REDACTED]",
  });
});
