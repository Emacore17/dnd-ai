import assert from "node:assert/strict";
import test from "node:test";

import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";

import { createConfiguredApiApp } from "../../apps/api/dist/index.js";
import { createObservedWorkerProcessor } from "../../apps/worker/dist/index.js";
import { createNodeObservability } from "../../packages/observability/dist/node.js";

const apiEnvironment = {
  APP_ENV: "local",
  API_DATABASE_URL: "postgresql://api@127.0.0.1:5432/dnd_ai",
  API_HOST: "127.0.0.1",
  API_PORT: "3001",
  API_REDIS_URL: "redis://127.0.0.1:6379/0",
  API_PUBLIC_ORIGIN: "http://127.0.0.1:3000",
  API_AUTH_PASSWORD_PEPPER_BASE64:
    "YGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn8=",
  API_AUTH_PASSWORD_PEPPER_VERSION: "3",
  API_AUTH_CHALLENGE_HMAC_KEY_BASE64:
    "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
  API_AUTH_CHALLENGE_KEY_VERSION: "7",
  API_AUTH_SESSION_HMAC_KEY_BASE64:
    "ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8=",
  API_AUTH_SESSION_KEY_VERSION: "9",
  API_AUTH_RESET_HMAC_KEY_BASE64:
    "oKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr8=",
  API_AUTH_RESET_KEY_VERSION: "11",
  API_AUTH_SUBJECT_HASH_KEY_BASE64:
    "QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xdXl8=",
  API_AUTH_BFF_ASSERTION_KEY_BASE64:
    "gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmam5ydnp8=",
};

test("trace and request ID cross web, Fastify, queue metadata and worker without context bleed", async (context) => {
  const exporter = new InMemorySpanExporter();
  const logDestination = { write() {} };
  const web = createNodeObservability({
    environment: "local",
    logDestination,
    service: "web",
    spanExporter: exporter,
  });
  const api = createNodeObservability({
    environment: "local",
    logDestination,
    service: "api",
    spanExporter: exporter,
  });
  const worker = createNodeObservability({
    environment: "local",
    logDestination,
    service: "worker",
    spanExporter: exporter,
  });
  const configuredApi = createConfiguredApiApp({
    createObservability: () => api,
    environment: apiEnvironment,
  });
  const processEnvelope = createObservedWorkerProcessor(
    worker,
    async (_payload, workerContext) => workerContext,
  );

  context.after(async () => {
    await configuredApi.app.close();
    await worker.shutdown(100);
    await web.shutdown(100);
  });

  configuredApi.app.post("/observability-flow", async () => {
    const enqueueOperation = api.startOperation({
      kind: "producer",
      name: "queue.enqueue",
    });

    try {
      return enqueueOperation.run(() => ({
        observability: enqueueOperation.inject(),
        payload: { kind: "synthetic" },
      }));
    } finally {
      enqueueOperation.end();
    }
  });

  async function runFlow() {
    const webOperation = web.startOperation({
      kind: "client",
      name: "web.request",
    });

    try {
      return await webOperation.run(async () => {
        const carrier = webOperation.inject();
        const response = await configuredApi.app.inject({
          headers: {
            "x-request-id": carrier.requestId,
            ...(carrier.traceparent === undefined
              ? {}
              : { traceparent: carrier.traceparent }),
            ...(carrier.tracestate === undefined
              ? {}
              : { tracestate: carrier.tracestate }),
          },
          method: "POST",
          url: "/observability-flow",
        });

        assert.equal(response.statusCode, 200);
        const envelope = response.json();
        const workerContext = await processEnvelope(envelope);

        return {
          apiRequestId: response.headers["x-request-id"],
          queueRequestId: envelope.observability.requestId,
          webContext: webOperation.context,
          workerContext,
        };
      });
    } finally {
      webOperation.end();
    }
  }

  const flows = await Promise.all([runFlow(), runFlow()]);
  const spans = exporter.getFinishedSpans();

  assert.equal(spans.length, 8);
  assert.equal(new Set(spans.map((span) => span.spanContext().spanId)).size, 8);
  assert.equal(new Set(flows.map((flow) => flow.webContext.traceId)).size, 2);
  assert.equal(new Set(flows.map((flow) => flow.webContext.requestId)).size, 2);

  for (const flow of flows) {
    assert.equal(flow.apiRequestId, flow.webContext.requestId);
    assert.equal(flow.queueRequestId, flow.webContext.requestId);
    assert.equal(flow.workerContext.requestId, flow.webContext.requestId);
    assert.equal(flow.workerContext.traceId, flow.webContext.traceId);

    const traceSpans = spans.filter(
      (span) => span.spanContext().traceId === flow.webContext.traceId,
    );
    assert.deepEqual(traceSpans.map((span) => span.name).sort(), [
      "api.request",
      "queue.enqueue",
      "web.request",
      "worker.process",
    ]);

    const webSpan = traceSpans.find((span) => span.name === "web.request");
    const apiSpan = traceSpans.find((span) => span.name === "api.request");
    const queueSpan = traceSpans.find((span) => span.name === "queue.enqueue");
    const workerSpan = traceSpans.find(
      (span) => span.name === "worker.process",
    );

    assert.ok(webSpan);
    assert.ok(apiSpan);
    assert.ok(queueSpan);
    assert.ok(workerSpan);
    assert.equal(webSpan.parentSpanContext, undefined);
    assert.equal(
      apiSpan.parentSpanContext?.spanId,
      webSpan.spanContext().spanId,
    );
    assert.equal(
      queueSpan.parentSpanContext?.spanId,
      apiSpan.spanContext().spanId,
    );
    assert.equal(
      workerSpan.parentSpanContext?.spanId,
      queueSpan.spanContext().spanId,
    );
  }
});

test("telemetry failures do not change API responses or worker results", async (context) => {
  const telemetryCanary = "telemetry player@example.test Bearer secret-token";
  const failingDestination = {
    write() {
      throw new Error(telemetryCanary);
    },
  };
  const failingExporter = {
    export() {
      throw new Error(telemetryCanary);
    },
    shutdown() {
      return Promise.resolve();
    },
  };
  const failingTransport = () => ({
    flush: () => Promise.reject(new Error(telemetryCanary)),
    send: () => {
      throw new Error(telemetryCanary);
    },
  });
  const api = createNodeObservability({
    environment: "local",
    logDestination: failingDestination,
    sentryDsn: "https://public@errors.example.test/101",
    sentryTransport: failingTransport,
    service: "api",
    spanExporter: failingExporter,
  });
  const worker = createNodeObservability({
    environment: "local",
    logDestination: failingDestination,
    sentryDsn: "https://public@errors.example.test/101",
    sentryTransport: failingTransport,
    service: "worker",
    spanExporter: failingExporter,
  });
  const configuredApi = createConfiguredApiApp({
    createObservability: () => api,
    environment: apiEnvironment,
  });
  const successfulProcessor = createObservedWorkerProcessor(
    worker,
    async (payload) => ({ accepted: payload.kind }),
  );
  const businessError = new Error("synthetic business failure");
  const failingProcessor = createObservedWorkerProcessor(worker, async () => {
    throw businessError;
  });

  context.after(async () => {
    await configuredApi.app.close();
    await worker.shutdown(100);
  });

  configuredApi.app.get("/telemetry-success", async () => ({ ok: true }));
  configuredApi.app.get("/telemetry-error", async () => {
    throw businessError;
  });

  const successResponse = await configuredApi.app.inject({
    method: "GET",
    url: "/telemetry-success",
  });
  assert.equal(successResponse.statusCode, 200);
  assert.deepEqual(successResponse.json(), { ok: true });

  const errorResponse = await configuredApi.app.inject({
    method: "GET",
    url: "/telemetry-error",
  });
  assert.equal(errorResponse.statusCode, 500);

  const operation = api.startOperation({
    kind: "producer",
    name: "queue.enqueue",
  });
  const envelope = {
    observability: operation.inject(),
    payload: { kind: "synthetic" },
  };
  operation.end();

  assert.deepEqual(await successfulProcessor(envelope), {
    accepted: "synthetic",
  });
  await assert.rejects(failingProcessor(envelope), (error) => {
    assert.equal(error, businessError);
    return true;
  });
});
