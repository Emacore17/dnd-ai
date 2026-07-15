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
