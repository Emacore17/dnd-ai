import * as Sentry from "@sentry/node";
import type { ErrorEvent, NodeOptions, SeverityLevel } from "@sentry/node";

import type {
  ErrorReporter,
  ObservabilityContext,
  SafeErrorMetadata,
} from "./contracts.js";
import { createNoopErrorReporter } from "./error-reporting.js";
import { sanitizeSentryEvent, type SanitizedSentryEvent } from "./redaction.js";

export type SentryTransportFactory = NonNullable<NodeOptions["transport"]>;

interface SentryErrorReporterOptions {
  readonly dsn?: string;
  readonly environment: "local" | "staging" | "production";
  readonly release?: string;
  readonly transport?: SentryTransportFactory;
}

export function createSentryErrorReporter(
  options: SentryErrorReporterOptions,
): ErrorReporter {
  if (options.dsn === undefined) {
    return createNoopErrorReporter();
  }

  let client: ReturnType<typeof Sentry.initWithoutDefaultIntegrations>;

  try {
    client = Sentry.initWithoutDefaultIntegrations({
      beforeSend(event) {
        const metadata = readEventMetadata(event);
        return toMutableSentryEvent(sanitizeSentryEvent(event, metadata));
      },
      dsn: options.dsn,
      enableLogs: false,
      environment: options.environment,
      registerEsmLoaderHooks: false,
      ...(options.release === undefined ? {} : { release: options.release }),
      sendDefaultPii: false,
      skipOpenTelemetrySetup: true,
      tracesSampleRate: 0,
      ...(options.transport === undefined
        ? {}
        : { transport: options.transport }),
    });
  } catch {
    return createNoopErrorReporter();
  }

  if (client === undefined) {
    return createNoopErrorReporter();
  }

  return Object.freeze({
    capture(
      error: unknown,
      context: ObservabilityContext,
      metadata: SafeErrorMetadata,
    ): void {
      try {
        const scope = new Sentry.Scope();
        scope.setTags({
          errorCode: metadata.errorCode,
          event: metadata.event,
        });
        scope.setContext("correlation", {
          requestId: context.requestId,
          traceId: context.traceId,
        });
        client.captureException(error, undefined, scope);
      } catch {
        // Error reporting must never change the application result.
      }
    },
    async flush(timeoutMs: number): Promise<boolean> {
      if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
        return false;
      }

      try {
        return await client.flush(timeoutMs);
      } catch {
        return false;
      }
    },
  });
}

function readEventMetadata(event: ErrorEvent): SafeErrorMetadata {
  const eventName = event.tags?.event;
  const errorCode = event.tags?.errorCode;

  return {
    event: typeof eventName === "string" ? eventName : "error.captured",
    errorCode: typeof errorCode === "string" ? errorCode : "UNEXPECTED_ERROR",
  };
}

function toMutableSentryEvent(event: SanitizedSentryEvent): ErrorEvent {
  return {
    type: undefined,
    ...(event.breadcrumbs === undefined
      ? {}
      : {
          breadcrumbs: event.breadcrumbs.map((breadcrumb) => {
            const level = toSentrySeverityLevel(breadcrumb.level);

            return {
              ...(breadcrumb.category === undefined
                ? {}
                : { category: breadcrumb.category }),
              ...(level === undefined ? {} : { level }),
              message: breadcrumb.message,
              ...(breadcrumb.timestamp === undefined
                ? {}
                : { timestamp: breadcrumb.timestamp }),
            };
          }),
        }),
    ...(event.contexts === undefined
      ? {}
      : {
          contexts: {
            correlation: {
              requestId: event.contexts.trace.requestId,
              traceId: event.contexts.trace.traceId,
            },
          },
        }),
    ...(event.environment === undefined
      ? {}
      : { environment: event.environment }),
    ...(event.event_id === undefined ? {} : { event_id: event.event_id }),
    ...(event.exception === undefined
      ? {}
      : {
          exception: {
            values: event.exception.values.map((exception) => ({
              ...(exception.stacktrace === undefined
                ? {}
                : {
                    stacktrace: {
                      frames: exception.stacktrace.frames.map((frame) => ({
                        ...(frame.colno === undefined
                          ? {}
                          : { colno: frame.colno }),
                        ...(frame.filename === undefined
                          ? {}
                          : { filename: frame.filename }),
                        ...(frame.function === undefined
                          ? {}
                          : { function: frame.function }),
                        ...(frame.in_app === undefined
                          ? {}
                          : { in_app: frame.in_app }),
                        ...(frame.lineno === undefined
                          ? {}
                          : { lineno: frame.lineno }),
                      })),
                    },
                  }),
              type: exception.type,
              value: exception.value,
            })),
          },
        }),
    fingerprint: [...event.fingerprint],
    ...(event.release === undefined ? {} : { release: event.release }),
    tags: { ...event.tags },
  };
}

function toSentrySeverityLevel(
  input: string | undefined,
): SeverityLevel | undefined {
  return input === "debug" ||
    input === "info" ||
    input === "warning" ||
    input === "error" ||
    input === "fatal"
    ? input
    : undefined;
}
