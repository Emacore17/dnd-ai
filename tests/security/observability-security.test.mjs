import assert from "node:assert/strict";
import test from "node:test";

import {
  createSentryErrorOnlyOptions,
  initializeSentryErrorOnly,
  sanitizeSentryEvent,
} from "../../packages/observability/dist/index.js";

const requestId = "6f9619ff-8b86-4a5d-9f6d-8f6f3e9f4a31";
const traceId = "c4b7f268f713f241fd4b92c8461e3991";
const canaries = [
  "player@example.test",
  "Bearer secret-token",
  "session=secret-cookie",
  "database-password",
  "https://public-key@errors.example.test/101",
  "raw player prompt",
  "raw AI output",
  "raw tool payload",
];

test("sanitizeSentryEvent preserves only the approved diagnostic envelope", () => {
  const event = {
    environment: "production",
    release: "web-2026.07.15",
    user: { email: canaries[0] },
    request: {
      headers: { authorization: canaries[1], cookie: canaries[2] },
      data: canaries[5],
    },
    contexts: {
      trace: { requestId, traceId, spanId: "0123456789abcdef" },
      character: { prompt: canaries[5] },
    },
    exception: {
      values: [
        {
          type: "TypeError",
          value: canaries[6],
          stacktrace: {
            frames: [
              {
                filename: "C:\\Users\\player@example.test\\src\\turn.ts",
                function: "processTurn",
                lineno: 42,
                colno: 7,
                in_app: true,
                context_line: canaries[5],
                vars: { password: canaries[3] },
              },
            ],
          },
        },
      ],
    },
    breadcrumbs: [
      {
        timestamp: 1_784_109_600,
        level: "info",
        category: "api.request",
        message: "api.request.failed",
        data: { toolPayload: canaries[7] },
      },
      {
        level: "info",
        category: "chat",
        message: canaries[5],
      },
    ],
    extra: { dsn: canaries[4], narration: canaries[6] },
    attachments: [{ filename: canaries[0] }],
    replay: { id: canaries[2] },
    session: { status: canaries[3] },
  };

  const sanitized = sanitizeSentryEvent(event, {
    event: "error.captured",
    errorCode: "TURN_PROCESSING_FAILED",
  });
  const serialized = JSON.stringify(sanitized);

  for (const canary of canaries) {
    assert.doesNotMatch(serialized, new RegExp(canary, "u"));
  }

  assert.deepEqual(sanitized, {
    breadcrumbs: [
      {
        category: "api.request",
        level: "info",
        message: "api.request.failed",
        timestamp: 1_784_109_600,
      },
    ],
    contexts: { trace: { requestId, traceId } },
    environment: "production",
    exception: {
      values: [
        {
          stacktrace: {
            frames: [
              {
                colno: 7,
                filename: "turn.ts",
                function: "processTurn",
                in_app: true,
                lineno: 42,
              },
            ],
          },
          type: "TypeError",
          value: "TURN_PROCESSING_FAILED",
        },
      ],
    },
    fingerprint: ["TURN_PROCESSING_FAILED"],
    release: "web-2026.07.15",
    tags: {
      errorCode: "TURN_PROCESSING_FAILED",
      event: "error.captured",
    },
  });
  assert.equal(Object.isFrozen(sanitized), true);
  assert.equal(Object.isFrozen(sanitized.exception.values), true);
});

test("sanitizeSentryEvent fails closed for hostile events and metadata", () => {
  let getterCalls = 0;
  const hostileEvent = {};
  Object.defineProperty(hostileEvent, "environment", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "production";
    },
  });

  const sanitized = sanitizeSentryEvent(hostileEvent, {
    event: "player@example.test",
    errorCode: "secret error message",
  });

  assert.equal(getterCalls, 0);
  assert.deepEqual(sanitized, {
    fingerprint: ["UNEXPECTED_ERROR"],
    tags: { errorCode: "UNEXPECTED_ERROR", event: "error.captured" },
  });

  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  assert.doesNotThrow(() =>
    sanitizeSentryEvent(revoked.proxy, {
      event: "error.captured",
      errorCode: "UNEXPECTED_ERROR",
    }),
  );
});

test("error-only Sentry setup is inert without a valid DSN and uses a fake transport", () => {
  let initCalls = 0;
  const init = (options) => {
    initCalls += 1;
    return options;
  };

  for (const dsn of [
    undefined,
    "",
    "http://public@errors.example.test/101",
    "https://public:secret@errors.example.test/101",
    "https://public@errors.example.test/not-a-project",
  ]) {
    assert.equal(
      initializeSentryErrorOnly(init, {
        dsn,
        environment: "local",
      }),
      false,
    );
  }
  assert.equal(initCalls, 0);

  const fakeTransport = () => ({
    flush: () => Promise.resolve(true),
    send: () => Promise.resolve({ statusCode: 200 }),
  });
  let initializedOptions;

  assert.equal(
    initializeSentryErrorOnly(
      (options) => {
        initializedOptions = options;
      },
      {
        dsn: "https://public@errors.example.test/101",
        environment: "production",
        release: "web-2026.07.15",
        transport: fakeTransport,
      },
    ),
    true,
  );
  assert.ok(initializedOptions);
  assert.equal(initializedOptions.sendDefaultPii, false);
  assert.equal(initializedOptions.tracesSampleRate, 0);
  assert.equal(initializedOptions.enableLogs, false);
  assert.equal(initializedOptions.transport, fakeTransport);
  assert.equal("integrations" in initializedOptions, false);
  assert.equal("replaysSessionSampleRate" in initializedOptions, false);
  assert.equal("replaysOnErrorSampleRate" in initializedOptions, false);

  const sanitized = initializedOptions.beforeSend({
    environment: "production",
    release: "web-2026.07.15",
    tags: {
      errorCode: "TURN_PROCESSING_FAILED",
      event: "error.captured",
    },
    request: { data: canaries[5] },
    extra: { dsn: canaries[4] },
  });
  const serialized = JSON.stringify(sanitized);

  assert.equal(sanitized.tags.errorCode, "TURN_PROCESSING_FAILED");
  for (const canary of canaries) {
    assert.doesNotMatch(serialized, new RegExp(canary, "u"));
  }

  assert.equal(
    createSentryErrorOnlyOptions({ environment: "local" }),
    undefined,
  );
  assert.equal(
    initializeSentryErrorOnly(
      () => {
        throw new Error(canaries[5]);
      },
      {
        dsn: "https://public@errors.example.test/101",
        environment: "local",
      },
    ),
    false,
  );
});
