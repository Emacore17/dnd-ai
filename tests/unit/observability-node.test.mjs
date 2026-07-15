import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";

import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";

import {
  createNodeObservability,
  ObservabilityConfigurationError,
} from "../../packages/observability/dist/node.js";

const rawCanary = "raw player@example.test prompt Bearer secret-token";

function memoryDestination(lines) {
  return {
    write(line) {
      lines.push(line);
    },
  };
}

test("createNodeObservability propagates W3C context and emits correlated safe logs", async () => {
  const exporter = new InMemorySpanExporter();
  const lines = [];
  const web = createNodeObservability({
    environment: "local",
    logDestination: memoryDestination(lines),
    service: "web",
    spanExporter: exporter,
  });
  const api = createNodeObservability({
    environment: "local",
    logDestination: memoryDestination(lines),
    service: "api",
    spanExporter: exporter,
  });
  const webOperation = web.startOperation({
    kind: "server",
    name: "web.request",
  });

  assert.equal(web.currentContext(), undefined);

  const carrier = await webOperation.run(async () => {
    assert.deepEqual(web.currentContext(), webOperation.context);
    assert.equal(
      webOperation.log("info", {
        authorization: rawCanary,
        campaignHash: "campaign-hash",
        durationMs: 12,
        event: "web.request.started",
        prompt: rawCanary,
        turnId: "turn-1",
      }),
      true,
    );
    await Promise.resolve();
    assert.deepEqual(web.currentContext(), webOperation.context);

    return webOperation.inject();
  });

  assert.equal(web.currentContext(), undefined);
  assert.match(carrier.traceparent, /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u);
  assert.equal("baggage" in carrier, false);
  assert.equal(Object.isFrozen(carrier), true);
  webOperation.end();

  const apiOperation = api.startOperation({
    carrier,
    kind: "server",
    name: "api.request",
  });
  apiOperation.end();

  const spans = exporter.getFinishedSpans();
  const webSpan = spans.find((span) => span.name === "web.request");
  const apiSpan = spans.find((span) => span.name === "api.request");

  assert.ok(webSpan);
  assert.ok(apiSpan);
  assert.equal(apiSpan.spanContext().traceId, webSpan.spanContext().traceId);
  assert.equal(apiSpan.parentSpanContext?.spanId, webSpan.spanContext().spanId);
  assert.notEqual(apiSpan.spanContext().spanId, webSpan.spanContext().spanId);
  assert.equal(apiOperation.context.requestId, webOperation.context.requestId);

  assert.equal(lines.length, 1);
  const log = JSON.parse(lines[0]);

  assert.equal(log.event, "web.request.started");
  assert.equal(log.level, "info");
  assert.equal(log.service, "web");
  assert.equal(log.environment, "local");
  assert.equal(log.requestId, webOperation.context.requestId);
  assert.equal(log.traceId, webOperation.context.traceId);
  assert.equal(log.spanId, webOperation.context.spanId);
  assert.equal(log.turnId, "turn-1");
  assert.equal(log.campaignHash, "campaign-hash");
  assert.equal(log.durationMs, 12);
  assert.equal(typeof log.timestamp, "number");
  assert.equal("pid" in log, false);
  assert.equal("hostname" in log, false);
  assert.equal("msg" in log, false);
  assert.equal("authorization" in log, false);
  assert.equal("prompt" in log, false);
  assert.doesNotMatch(JSON.stringify(log), new RegExp(rawCanary, "u"));

  assert.equal(await api.shutdown(100), true);
  assert.equal(await web.shutdown(100), true);
});

test("invalid incoming correlation creates a fresh trace and safe rejection warnings", async (context) => {
  const exporter = new InMemorySpanExporter();
  const lines = [];
  const invalidCarrier = "raw player@example.test prompt Bearer secret-token";
  const runtime = createNodeObservability({
    environment: "local",
    logDestination: memoryDestination(lines),
    service: "api",
    spanExporter: exporter,
  });
  context.after(() => runtime.shutdown(100));
  const operation = runtime.startOperation({
    carrier: {
      requestId: invalidCarrier,
      traceparent: invalidCarrier,
      tracestate: invalidCarrier,
    },
    kind: "server",
    name: "api.request",
  });

  operation.end();

  assert.match(
    operation.context.requestId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
  );
  assert.notEqual(operation.context.requestId, invalidCarrier);

  const span = exporter.getFinishedSpans()[0];
  assert.ok(span);
  assert.equal(span.parentSpanContext, undefined);

  const logs = lines.map((line) => JSON.parse(line));
  assert.deepEqual(logs.map((log) => log.event).sort(), [
    "request_id.rejected",
    "trace_context.rejected",
  ]);
  for (const log of logs) {
    assert.equal(log.level, "warn");
    assert.equal(log.requestId, operation.context.requestId);
    assert.equal(log.traceId, operation.context.traceId);
  }
  assert.doesNotMatch(JSON.stringify(logs), new RegExp(invalidCarrier, "u"));
});

test("operation context remains isolated across concurrent async callbacks", async () => {
  const runtime = createNodeObservability({
    environment: "local",
    service: "worker",
  });
  const first = runtime.startOperation({
    kind: "consumer",
    name: "worker.process",
  });
  const second = runtime.startOperation({
    kind: "consumer",
    name: "worker.process",
  });
  const firstGate = Promise.withResolvers();
  const secondGate = Promise.withResolvers();

  const firstRun = first.run(async () => {
    await firstGate.promise;
    return runtime.currentContext();
  });
  const secondRun = second.run(async () => {
    await secondGate.promise;
    return runtime.currentContext();
  });

  firstGate.resolve();
  secondGate.resolve();

  const [firstContext, secondContext] = await Promise.all([
    firstRun,
    secondRun,
  ]);

  assert.deepEqual(firstContext, first.context);
  assert.deepEqual(secondContext, second.context);
  assert.notEqual(firstContext.traceId, secondContext.traceId);
  assert.notEqual(firstContext.requestId, secondContext.requestId);
  assert.equal(runtime.currentContext(), undefined);

  first.end();
  second.end();
  assert.equal(await runtime.shutdown(100), true);
});

test("direct Node setup rejects malformed Sentry DSNs instead of silently disabling reports", async () => {
  const invalidDsns = [
    "https://public@errors.example.test/not-a-project-id",
    "https://public@errors.example.test/101/",
    "https://public@bad_host/101",
  ];

  for (const sentryDsn of invalidDsns) {
    let unexpectedRuntime;

    try {
      assert.throws(
        () => {
          unexpectedRuntime = createNodeObservability({
            environment: "local",
            sentryDsn,
            service: "worker",
          });
        },
        (error) => {
          assert.ok(error instanceof ObservabilityConfigurationError);
          assert.equal(error.code, "OBSERVABILITY_CONFIG_INVALID");
          assert.equal(error.message.includes(sentryDsn), false);
          return true;
        },
      );
    } finally {
      await unexpectedRuntime?.shutdown(100);
    }
  }
});

test("initialization is idempotent for equal config and rejects incompatible config safely", async () => {
  const options = {
    environment: "production",
    sentryDsn: "https://public@example.invalid/1",
    sentryTransport: () => ({
      flush: () => Promise.resolve(true),
      send: () => Promise.resolve({ statusCode: 200 }),
    }),
    service: "api",
  };
  const first = createNodeObservability(options);
  const second = createNodeObservability(options);

  assert.equal(second, first);
  assert.throws(
    () =>
      createNodeObservability({
        ...options,
        environment: "staging",
      }),
    (error) => {
      assert.ok(error instanceof ObservabilityConfigurationError);
      assert.equal(error.code, "OBSERVABILITY_ALREADY_INITIALIZED");
      assert.doesNotMatch(error.message, /public|example|invalid/iu);
      return true;
    },
  );

  assert.equal(await first.shutdown(100), true);
});

test("Sentry uses an injected transport and sends only the sanitized error envelope", async () => {
  const envelopes = [];
  const exporter = new InMemorySpanExporter();
  const runtime = createNodeObservability({
    environment: "production",
    release: "api-2026.07.15",
    sentryDsn: "https://public@example.invalid/1",
    sentryTransport: () => ({
      flush: () => Promise.resolve(true),
      send: (envelope) => {
        envelopes.push(envelope);
        return Promise.resolve({ statusCode: 200 });
      },
    }),
    service: "api",
    spanExporter: exporter,
  });
  const operation = runtime.startOperation({
    kind: "server",
    name: "api.request",
  });

  operation.run(() => {
    operation.capture(new Error(rawCanary), {
      errorCode: "TURN_PROCESSING_FAILED",
      event: "error.captured",
    });
  });
  operation.end({ errorCode: "TURN_PROCESSING_FAILED" });
  operation.end({ errorCode: "MUST_NOT_DUPLICATE" });
  assert.equal(exporter.getFinishedSpans().length, 1);

  const firstShutdown = runtime.shutdown(250);
  const duplicateShutdown = runtime.shutdown(250);

  assert.equal(duplicateShutdown, firstShutdown);
  assert.equal(await firstShutdown, true);
  assert.equal(envelopes.length, 1);

  const sentryEvent = envelopes[0][1][0][1];
  assert.match(sentryEvent.event_id, /^[0-9a-f]{32}$/u);

  const serialized = JSON.stringify(envelopes);

  assert.match(serialized, /TURN_PROCESSING_FAILED/u);
  assert.match(serialized, new RegExp(operation.context.requestId, "u"));
  assert.match(serialized, new RegExp(operation.context.traceId, "u"));
  assert.doesNotMatch(serialized, new RegExp(rawCanary, "u"));
});

test("telemetry failures stay local and shutdown remains bounded", async () => {
  const never = new Promise(() => {});
  let getterCalls = 0;
  const runtime = createNodeObservability({
    environment: "local",
    logDestination: {
      write() {
        throw new Error(rawCanary);
      },
    },
    service: "web",
    spanExporter: {
      export(_spans, callback) {
        callback({ code: 0 });
      },
      forceFlush() {
        return Promise.resolve();
      },
      shutdown() {
        return never;
      },
    },
  });
  const operation = runtime.startOperation({
    kind: "server",
    name: "web.request",
  });

  const hostileEvent = {};
  Object.defineProperty(hostileEvent, "event", {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error(rawCanary);
    },
  });
  let hostileLogResult;

  assert.doesNotThrow(() => {
    hostileLogResult = operation.log("info", hostileEvent);
  });
  assert.equal(hostileLogResult, false);
  assert.equal(getterCalls, 0);
  assert.equal(
    operation.log("verbose", { event: "web.request.started" }),
    false,
  );

  assert.equal(
    operation.log("error", {
      errorCode: "TELEMETRY_WRITE_FAILED",
      event: "web.request.failed",
    }),
    false,
  );
  operation.end({ errorCode: "TELEMETRY_EXPORT_FAILED" });

  const startedAt = performance.now();
  const shutdownResult = await runtime.shutdown(10);
  const elapsedMs = performance.now() - startedAt;

  assert.equal(shutdownResult, false);
  assert.ok(elapsedMs < 500, `shutdown took ${elapsedMs}ms`);

  const throwingRuntime = createNodeObservability({
    environment: "local",
    service: "web",
    spanExporter: {
      export(_spans, callback) {
        callback({ code: 0 });
      },
      shutdown() {
        throw new Error(rawCanary);
      },
    },
  });
  const throwingOperation = throwingRuntime.startOperation({
    name: "web.request",
  });
  throwingOperation.end();

  await assert.doesNotReject(async () => {
    assert.equal(await throwingRuntime.shutdown(100), false);
  });
});
