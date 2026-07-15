import type {
  NodeObservability,
  ObservedOperation,
  TraceCarrier,
} from "@dnd-ai/observability/node";
import type { FastifyInstance, FastifyRequest } from "fastify";

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 500;

interface RequestObservation {
  readonly operation: ObservedOperation;
  readonly startedAt: number;
  failed: boolean;
}

export interface RegisterApiObservabilityOptions {
  readonly shutdownTimeoutMs?: number;
}

export function registerApiObservability(
  app: FastifyInstance,
  observability: NodeObservability,
  options: RegisterApiObservabilityOptions = {},
): void {
  const requests = new WeakMap<FastifyRequest, RequestObservation>();
  const shutdownTimeoutMs = validTimeout(options.shutdownTimeoutMs)
    ? options.shutdownTimeoutMs
    : DEFAULT_SHUTDOWN_TIMEOUT_MS;

  app.addHook("onRequest", (request, reply, done) => {
    let operation: ObservedOperation;

    try {
      operation = observability.startOperation({
        carrier: readTraceCarrier(request),
        kind: "server",
        name: "api.request",
      });
    } catch {
      done();
      return;
    }

    requests.set(request, {
      failed: false,
      operation,
      startedAt: Date.now(),
    });
    reply.header("x-request-id", operation.context.requestId);
    operation.run(() => {
      operation.log("info", { event: "api.request.started" });
      done();
    });
  });

  app.addHook("onError", (request, _reply, error, done) => {
    const observation = requests.get(request);

    if (observation === undefined) {
      done();
      return;
    }

    observation.failed = true;
    observation.operation.run(() => {
      observation.operation.log("error", {
        errorCode: "API_REQUEST_FAILED",
        event: "api.request.failed",
      });
      observation.operation.capture(error, {
        errorCode: "API_REQUEST_FAILED",
        event: "error.captured",
      });
      done();
    });
  });

  app.addHook("onResponse", (request, reply, done) => {
    const observation = requests.get(request);

    if (observation === undefined) {
      done();
      return;
    }

    requests.delete(request);
    observation.operation.run(() => {
      const failed = observation.failed || reply.statusCode >= 500;
      const durationMs = Math.max(0, Date.now() - observation.startedAt);

      observation.operation.log(failed ? "error" : "info", {
        durationMs,
        ...(failed ? { errorCode: "API_REQUEST_FAILED" } : {}),
        event: failed ? "api.request.failed" : "api.request.completed",
      });
      observation.operation.end(
        failed ? { errorCode: "API_REQUEST_FAILED" } : undefined,
      );
      done();
    });
  });

  app.addHook("onClose", async () => {
    await observability.shutdown(shutdownTimeoutMs).catch(() => false);
  });
}

function readTraceCarrier(request: FastifyRequest): Partial<TraceCarrier> {
  const requestId = readHeader(request, "x-request-id");
  const traceparent = readHeader(request, "traceparent");
  const tracestate = readHeader(request, "tracestate");

  return Object.freeze({
    ...(requestId === undefined ? {} : { requestId }),
    ...(traceparent === undefined ? {} : { traceparent }),
    ...(tracestate === undefined ? {} : { tracestate }),
  });
}

function readHeader(request: FastifyRequest, name: string): string | undefined {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(request.headers, name);
    return descriptor?.enumerable === true &&
      "value" in descriptor &&
      typeof descriptor.value === "string"
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function validTimeout(input: unknown): input is number {
  return Number.isSafeInteger(input) && typeof input === "number" && input > 0;
}
