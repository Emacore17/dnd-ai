import {
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  createContextKey,
  isSpanContextValid,
  trace,
  type Context,
  type Span,
} from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import {
  SimpleSpanProcessor,
  type ReadableSpan,
  type SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

import type {
  ErrorReporter,
  ObservabilityContext,
  ObservabilityService,
  SafeErrorMetadata,
  SafeLogEvent,
  TraceCarrier,
} from "./contracts.js";
import {
  createSafeLogger,
  isSafeTelemetryCode,
  type NodeLogDestination,
  type SafeLogLevel,
  type SafeStructuredLogger,
} from "./logger.js";
import { createRequestId } from "./request-id.js";
import {
  createSentryErrorReporter,
  type SentryTransportFactory,
} from "./sentry.js";

const REQUEST_ID_CONTEXT_KEY = createContextKey("dnd-ai.request-id");
const TRACE_CONTEXT_PROPAGATOR = new W3CTraceContextPropagator();
const MAX_RELEASE_LENGTH = 128;

export type ObservedOperationKind =
  "internal" | "server" | "client" | "producer" | "consumer";

export interface NodeObservabilityOptions {
  readonly service: ObservabilityService;
  readonly environment: "local" | "staging" | "production";
  readonly release?: string;
  readonly sentryDsn?: string;
  readonly sentryTransport?: SentryTransportFactory;
  readonly spanExporter?: SpanExporter;
  readonly logDestination?: NodeLogDestination;
}

export interface StartOperationOptions {
  readonly name: string;
  readonly kind?: ObservedOperationKind;
  readonly carrier?: Partial<TraceCarrier>;
  readonly requestId?: string;
}

export interface EndOperationOptions {
  readonly errorCode?: string;
}

export interface ObservedOperation {
  readonly context: ObservabilityContext;
  run<T>(callback: () => T): T;
  inject(): TraceCarrier;
  log(level: SafeLogLevel, event: SafeLogEvent): boolean;
  capture(error: unknown, metadata: SafeErrorMetadata): void;
  end(options?: EndOperationOptions): void;
}

export interface NodeObservability {
  startOperation(options: StartOperationOptions): ObservedOperation;
  currentContext(): ObservabilityContext | undefined;
  log(level: SafeLogLevel, event: SafeLogEvent): boolean;
  capture(error: unknown, metadata: SafeErrorMetadata): void;
  shutdown(timeoutMs: number): Promise<boolean>;
}

export class ObservabilityConfigurationError extends Error {
  readonly code:
    | "OBSERVABILITY_ALREADY_INITIALIZED"
    | "OBSERVABILITY_CONFIG_INVALID"
    | "OBSERVABILITY_SHUTDOWN";

  constructor(
    code:
      | "OBSERVABILITY_ALREADY_INITIALIZED"
      | "OBSERVABILITY_CONFIG_INVALID"
      | "OBSERVABILITY_SHUTDOWN",
    message: string,
  ) {
    super(message);
    this.name = "ObservabilityConfigurationError";
    this.code = code;
  }
}

interface ActiveRuntime {
  readonly options: NodeObservabilityOptions;
  readonly runtime: NodeObservability;
}

const activeRuntimes = new Map<ObservabilityService, ActiveRuntime>();

export function createNodeObservability(
  options: NodeObservabilityOptions,
): NodeObservability {
  validateOptions(options);

  const active = activeRuntimes.get(options.service);

  if (active !== undefined) {
    if (sameOptions(active.options, options)) {
      return active.runtime;
    }

    throw new ObservabilityConfigurationError(
      "OBSERVABILITY_ALREADY_INITIALIZED",
      "Observability is already initialized with incompatible configuration.",
    );
  }

  const contextManager = new AsyncLocalStorageContextManager().enable();
  const spanProcessors =
    options.spanExporter === undefined
      ? []
      : [
          new SimpleSpanProcessor(
            new FailSafeSpanExporter(options.spanExporter),
          ),
        ];
  const provider = new NodeTracerProvider({ spanProcessors });
  const tracer = provider.getTracer("@dnd-ai/observability", "1.0.0");
  const reporter = createSentryErrorReporter({
    environment: options.environment,
    ...(options.release === undefined ? {} : { release: options.release }),
    ...(options.sentryDsn === undefined ? {} : { dsn: options.sentryDsn }),
    ...(options.sentryTransport === undefined
      ? {}
      : { transport: options.sentryTransport }),
  });
  let stopped = false;
  let shutdownPromise: Promise<boolean> | undefined;
  const currentContext = (): ObservabilityContext | undefined =>
    readObservabilityContext(
      contextManager.active(),
      options.service,
      options.environment,
    );
  const logger = createSafeLogger({
    currentContext,
    environment: options.environment,
    service: options.service,
    ...(options.logDestination === undefined
      ? {}
      : { destination: options.logDestination }),
  });

  const runtime: NodeObservability = Object.freeze({
    startOperation(operationOptions: StartOperationOptions): ObservedOperation {
      if (stopped) {
        throw new ObservabilityConfigurationError(
          "OBSERVABILITY_SHUTDOWN",
          "Observability has already shut down.",
        );
      }

      return startObservedOperation({
        contextManager,
        environment: options.environment,
        logger,
        options: operationOptions,
        reporter,
        service: options.service,
        tracer,
      });
    },
    currentContext,
    log(level: SafeLogLevel, event: SafeLogEvent): boolean {
      return logger.log(level, event);
    },
    capture(error: unknown, metadata: SafeErrorMetadata): void {
      const context = currentContext();

      if (context !== undefined) {
        reporter.capture(error, context, metadata);
      }
    },
    shutdown(timeoutMs: number): Promise<boolean> {
      if (shutdownPromise !== undefined) {
        return shutdownPromise;
      }

      stopped = true;
      shutdownPromise = shutdownRuntime({
        contextManager,
        onSettled() {
          if (activeRuntimes.get(options.service)?.runtime === runtime) {
            activeRuntimes.delete(options.service);
          }
        },
        provider,
        reporter,
        timeoutMs,
      });

      return shutdownPromise;
    },
  });

  activeRuntimes.set(options.service, { options, runtime });
  return runtime;
}

interface StartObservedOperationOptions {
  readonly contextManager: AsyncLocalStorageContextManager;
  readonly environment: "local" | "staging" | "production";
  readonly logger: SafeStructuredLogger;
  readonly options: StartOperationOptions;
  readonly reporter: ErrorReporter;
  readonly service: ObservabilityService;
  readonly tracer: ReturnType<NodeTracerProvider["getTracer"]>;
}

function startObservedOperation(
  input: StartObservedOperationOptions,
): ObservedOperation {
  if (!isSafeTelemetryCode(input.options.name)) {
    throw new ObservabilityConfigurationError(
      "OBSERVABILITY_CONFIG_INVALID",
      "Observability operation metadata is invalid.",
    );
  }

  const carrierRequestId = readCarrierValue(input.options.carrier, "requestId");
  const inheritedContext = input.contextManager.active();
  const parentContext =
    input.options.carrier === undefined
      ? inheritedContext
      : extractTraceContext(input.options.carrier);
  const inheritedRequestId = parentContext.getValue(REQUEST_ID_CONTEXT_KEY);
  const requestIdCandidate =
    typeof input.options.requestId === "string"
      ? input.options.requestId
      : typeof carrierRequestId === "string"
        ? carrierRequestId
        : typeof inheritedRequestId === "string"
          ? inheritedRequestId
          : undefined;
  const requestId = createRequestId(requestIdCandidate);
  const parentContextWithRequestId = parentContext.setValue(
    REQUEST_ID_CONTEXT_KEY,
    requestId,
  );
  const span = input.tracer.startSpan(
    input.options.name,
    { kind: toSpanKind(input.options.kind) },
    parentContextWithRequestId,
  );
  const activeContext = trace
    .setSpan(parentContextWithRequestId, span)
    .setValue(REQUEST_ID_CONTEXT_KEY, requestId);
  const operationContext = makeObservabilityContext(
    span,
    requestId,
    input.service,
    input.environment,
  );
  let ended = false;

  return Object.freeze({
    context: operationContext,
    run<T>(callback: () => T): T {
      return input.contextManager.with(activeContext, callback);
    },
    inject(): TraceCarrier {
      return injectTraceContext(activeContext, requestId);
    },
    log(level: SafeLogLevel, event: SafeLogEvent): boolean {
      return input.contextManager.with(activeContext, () =>
        input.logger.log(level, event),
      );
    },
    capture(error: unknown, metadata: SafeErrorMetadata): void {
      input.contextManager.with(activeContext, () => {
        input.reporter.capture(error, operationContext, metadata);
      });
    },
    end(options?: EndOperationOptions): void {
      if (ended) {
        return;
      }

      ended = true;

      try {
        if (options?.errorCode === undefined) {
          span.setStatus({ code: SpanStatusCode.OK });
        } else {
          const errorCode = isSafeTelemetryCode(options.errorCode)
            ? options.errorCode
            : "UNEXPECTED_ERROR";
          span.setAttribute("error.code", errorCode);
          span.setStatus({ code: SpanStatusCode.ERROR });
        }

        span.end();
      } catch {
        // Exporter failures are telemetry failures, never application failures.
      }
    },
  });
}

function readObservabilityContext(
  activeContext: Context,
  service: ObservabilityService,
  environment: "local" | "staging" | "production",
): ObservabilityContext | undefined {
  const requestId = activeContext.getValue(REQUEST_ID_CONTEXT_KEY);
  const span = trace.getSpan(activeContext);

  if (typeof requestId !== "string" || span === undefined) {
    return undefined;
  }

  const spanContext = span.spanContext();

  return isSpanContextValid(spanContext)
    ? Object.freeze({
        environment,
        requestId,
        service,
        spanId: spanContext.spanId,
        traceId: spanContext.traceId,
      })
    : undefined;
}

function makeObservabilityContext(
  span: Span,
  requestId: string,
  service: ObservabilityService,
  environment: "local" | "staging" | "production",
): ObservabilityContext {
  const spanContext = span.spanContext();

  if (!isSpanContextValid(spanContext)) {
    throw new ObservabilityConfigurationError(
      "OBSERVABILITY_CONFIG_INVALID",
      "Observability failed to create a valid trace context.",
    );
  }

  return Object.freeze({
    environment,
    requestId,
    service,
    spanId: spanContext.spanId,
    traceId: spanContext.traceId,
  });
}

function extractTraceContext(
  carrier: Partial<TraceCarrier> | undefined,
): Context {
  const headers = new Map<string, string>();
  const traceparent = readCarrierValue(carrier, "traceparent");
  const tracestate = readCarrierValue(carrier, "tracestate");

  if (typeof traceparent === "string" && traceparent.length <= 128) {
    headers.set("traceparent", traceparent);
  }

  if (typeof tracestate === "string" && tracestate.length <= 512) {
    headers.set("tracestate", tracestate);
  }

  try {
    return TRACE_CONTEXT_PROPAGATOR.extract(ROOT_CONTEXT, headers, {
      get(currentHeaders, key) {
        return currentHeaders.get(key);
      },
      keys(currentHeaders) {
        return [...currentHeaders.keys()];
      },
    });
  } catch {
    return ROOT_CONTEXT;
  }
}

function injectTraceContext(
  activeContext: Context,
  requestId: string,
): TraceCarrier {
  const headers = new Map<string, string>();

  try {
    TRACE_CONTEXT_PROPAGATOR.inject(activeContext, headers, {
      set(currentHeaders, key, value) {
        currentHeaders.set(key, value);
      },
    });
  } catch {
    return Object.freeze({ requestId });
  }

  const traceparent = headers.get("traceparent");
  const tracestate = headers.get("tracestate");

  return Object.freeze({
    requestId,
    ...(traceparent === undefined ? {} : { traceparent }),
    ...(tracestate === undefined ? {} : { tracestate }),
  });
}

function readCarrierValue(
  carrier: Partial<TraceCarrier> | undefined,
  key: keyof TraceCarrier,
): unknown {
  if (carrier === undefined || typeof carrier !== "object") {
    return undefined;
  }

  try {
    const descriptor = Object.getOwnPropertyDescriptor(carrier, key);
    return descriptor?.enumerable === true && "value" in descriptor
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function toSpanKind(kind: ObservedOperationKind | undefined): SpanKind {
  switch (kind) {
    case "server":
      return SpanKind.SERVER;
    case "client":
      return SpanKind.CLIENT;
    case "producer":
      return SpanKind.PRODUCER;
    case "consumer":
      return SpanKind.CONSUMER;
    case "internal":
    case undefined:
      return SpanKind.INTERNAL;
  }
}

function validateOptions(options: NodeObservabilityOptions): void {
  const validService =
    options.service === "web" ||
    options.service === "api" ||
    options.service === "worker";
  const validEnvironment =
    options.environment === "local" ||
    options.environment === "staging" ||
    options.environment === "production";
  const validRelease =
    options.release === undefined || isSafeRelease(options.release);
  const validDsn =
    options.sentryDsn === undefined || isValidSentryDsn(options.sentryDsn);

  if (!validService || !validEnvironment || !validRelease || !validDsn) {
    throw new ObservabilityConfigurationError(
      "OBSERVABILITY_CONFIG_INVALID",
      "Observability configuration is invalid.",
    );
  }
}

function isSafeRelease(input: unknown): input is string {
  if (
    typeof input !== "string" ||
    input.length === 0 ||
    input.length > MAX_RELEASE_LENGTH
  ) {
    return false;
  }

  for (const character of input) {
    const code = character.charCodeAt(0);
    const isUppercase = code >= 65 && code <= 90;
    const isLowercase = code >= 97 && code <= 122;
    const isDigit = code >= 48 && code <= 57;
    const isPunctuation =
      character === "." ||
      character === "_" ||
      character === "+" ||
      character === "-";

    if (!isUppercase && !isLowercase && !isDigit && !isPunctuation) {
      return false;
    }
  }

  return true;
}

function isValidSentryDsn(input: unknown): input is string {
  if (typeof input !== "string" || input.length > 2_048) {
    return false;
  }

  try {
    const parsed = new URL(input);
    const projectSegments = parsed.pathname.split("/").filter(Boolean);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.length > 0 &&
      parsed.username.length > 0 &&
      parsed.password.length === 0 &&
      parsed.search.length === 0 &&
      parsed.hash.length === 0 &&
      projectSegments.length > 0
    );
  } catch {
    return false;
  }
}

function sameOptions(
  left: NodeObservabilityOptions,
  right: NodeObservabilityOptions,
): boolean {
  return (
    left.service === right.service &&
    left.environment === right.environment &&
    left.release === right.release &&
    left.sentryDsn === right.sentryDsn &&
    left.sentryTransport === right.sentryTransport &&
    left.spanExporter === right.spanExporter &&
    left.logDestination === right.logDestination
  );
}

interface ShutdownRuntimeOptions {
  readonly contextManager: AsyncLocalStorageContextManager;
  readonly onSettled: () => void;
  readonly provider: NodeTracerProvider;
  readonly reporter: ErrorReporter;
  readonly timeoutMs: number;
}

async function shutdownRuntime(
  options: ShutdownRuntimeOptions,
): Promise<boolean> {
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0) {
    options.contextManager.disable();
    options.onSettled();
    return false;
  }

  try {
    const completion = Promise.all([
      options.provider.shutdown(),
      options.reporter.flush(options.timeoutMs),
    ]).then(([, reporterFlushed]) => reporterFlushed);

    return await settleWithin(completion, options.timeoutMs);
  } finally {
    options.contextManager.disable();
    options.onSettled();
  }
}

async function settleWithin(
  operation: Promise<boolean>,
  timeoutMs: number,
): Promise<boolean> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const bounded = new Promise<boolean>((resolve) => {
    timeout = setTimeout(() => resolve(false), timeoutMs);
  });
  const settled = operation.catch(() => false);
  const result = await Promise.race([settled, bounded]);

  if (timeout !== undefined) {
    clearTimeout(timeout);
  }

  return result;
}

class FailSafeSpanExporter implements SpanExporter {
  readonly #delegate: SpanExporter;

  constructor(delegate: SpanExporter) {
    this.#delegate = delegate;
  }

  export(
    spans: ReadableSpan[],
    callback: Parameters<SpanExporter["export"]>[1],
  ): void {
    let settled = false;
    const settle: typeof callback = (result) => {
      if (!settled) {
        settled = true;
        callback(result);
      }
    };

    try {
      this.#delegate.export(spans, settle);
    } catch {
      settle({ code: 1 });
    }
  }

  forceFlush(): Promise<void> {
    return this.#delegate.forceFlush?.() ?? Promise.resolve();
  }

  shutdown(): Promise<void> {
    return this.#delegate.shutdown();
  }
}
