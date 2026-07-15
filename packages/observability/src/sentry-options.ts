import type { SafeErrorMetadata } from "./contracts.js";
import { sanitizeSentryEvent, type SanitizedSentryEvent } from "./redaction.js";

type RuntimeEnvironment = "local" | "staging" | "production";
type SentrySeverityLevel = "debug" | "info" | "warning" | "error" | "fatal";

interface MutableSentryFrame {
  colno?: number;
  filename?: string;
  function?: string;
  in_app?: boolean;
  lineno?: number;
}

interface MutableSentryException {
  stacktrace?: { frames: MutableSentryFrame[] };
  type: string;
  value: string;
}

export interface MutableSentryErrorEvent {
  type: undefined;
  breadcrumbs?: Array<{
    category?: string;
    level?: SentrySeverityLevel;
    message: string;
    timestamp?: number;
  }>;
  contexts?: {
    correlation: {
      requestId: string;
      traceId: string;
    };
  };
  environment?: RuntimeEnvironment;
  event_id?: string;
  exception?: { values: MutableSentryException[] };
  fingerprint: string[];
  release?: string;
  tags: { errorCode: string; event: string };
}

export interface SentryErrorOnlyConfiguration<Transport = never> {
  readonly dsn?: string | undefined;
  readonly environment: RuntimeEnvironment;
  readonly release?: string | undefined;
  readonly skipOpenTelemetrySetup?: true | undefined;
  readonly transport?: Transport | undefined;
}

export interface SentryErrorOnlyOptions<Transport = never> {
  beforeSend(event: unknown): MutableSentryErrorEvent;
  dsn: string;
  enableLogs: false;
  environment: RuntimeEnvironment;
  release?: string;
  sendDefaultPii: false;
  skipOpenTelemetrySetup?: true;
  tracesSampleRate: 0;
  transport?: Transport;
}

export function createSentryErrorOnlyOptions<Transport = never>(
  configuration: SentryErrorOnlyConfiguration<Transport>,
): SentryErrorOnlyOptions<Transport> | undefined {
  if (!isValidSentryDsn(configuration.dsn)) {
    return undefined;
  }

  const release = isSafeRelease(configuration.release)
    ? configuration.release
    : undefined;

  return {
    beforeSend(event: unknown): MutableSentryErrorEvent {
      return toMutableSentryEvent(
        sanitizeSentryEvent(event, readEventMetadata(event)),
      );
    },
    dsn: configuration.dsn,
    enableLogs: false,
    environment: configuration.environment,
    ...(release === undefined ? {} : { release }),
    sendDefaultPii: false,
    ...(configuration.skipOpenTelemetrySetup === true
      ? { skipOpenTelemetrySetup: true as const }
      : {}),
    tracesSampleRate: 0,
    ...(configuration.transport === undefined
      ? {}
      : { transport: configuration.transport }),
  };
}

export function initializeSentryErrorOnly<Transport = never>(
  initialize: (options: SentryErrorOnlyOptions<Transport>) => unknown,
  configuration: SentryErrorOnlyConfiguration<Transport>,
): boolean {
  const options = createSentryErrorOnlyOptions(configuration);

  if (options === undefined) {
    return false;
  }

  try {
    initialize(options);
    return true;
  } catch {
    return false;
  }
}

export function toMutableSentryEvent(
  event: SanitizedSentryEvent,
): MutableSentryErrorEvent {
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

function readEventMetadata(event: unknown): SafeErrorMetadata {
  const tags = getOwnDataValue(event, "tags");
  const eventName = getOwnDataValue(tags, "event");
  const errorCode = getOwnDataValue(tags, "errorCode");

  return {
    event: typeof eventName === "string" ? eventName : "error.captured",
    errorCode: typeof errorCode === "string" ? errorCode : "UNEXPECTED_ERROR",
  };
}

function getOwnDataValue(input: unknown, key: string): unknown {
  if (input === null || typeof input !== "object") {
    return undefined;
  }

  try {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    return descriptor?.enumerable === true && "value" in descriptor
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function isValidSentryDsn(input: unknown): input is string {
  if (typeof input !== "string" || input.length === 0 || input.length > 2_048) {
    return false;
  }

  try {
    const parsed = new URL(input);
    const projectId = parsed.pathname.split("/").filter(Boolean).at(-1);

    return (
      parsed.protocol === "https:" &&
      parsed.hostname.length > 0 &&
      parsed.username.length > 0 &&
      parsed.password.length === 0 &&
      parsed.search.length === 0 &&
      parsed.hash.length === 0 &&
      typeof projectId === "string" &&
      /^[1-9]\d*$/u.test(projectId)
    );
  } catch {
    return false;
  }
}

function isSafeRelease(input: unknown): input is string {
  return (
    typeof input === "string" &&
    input.length > 0 &&
    input.length <= 128 &&
    /^[A-Za-z0-9._+-]+$/u.test(input)
  );
}

function toSentrySeverityLevel(
  input: string | undefined,
): SentrySeverityLevel | undefined {
  return input === "debug" ||
    input === "info" ||
    input === "warning" ||
    input === "error" ||
    input === "fatal"
    ? input
    : undefined;
}
