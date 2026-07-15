import pino, {
  type DestinationStream,
  type Logger,
  type LoggerOptions,
} from "pino";

import type {
  ObservabilityContext,
  ObservabilityService,
  SafeLogEvent,
} from "./contracts.js";

const MAX_LOG_CODE_LENGTH = 128;

export type SafeLogLevel = "debug" | "info" | "warn" | "error";
export type NodeLogDestination = DestinationStream;

export interface SafeStructuredLogger {
  log(level: SafeLogLevel, event: SafeLogEvent): boolean;
}

interface SafeLoggerOptions {
  readonly service: ObservabilityService;
  readonly environment: "local" | "staging" | "production";
  readonly currentContext: () => ObservabilityContext | undefined;
  readonly destination?: NodeLogDestination;
}

export function createSafeLogger(
  options: SafeLoggerOptions,
): SafeStructuredLogger {
  const logger = createPinoLogger(options.destination);

  return Object.freeze({
    log(level: SafeLogLevel, event: SafeLogEvent): boolean {
      const eventName = getOwnDataValue(event, "event");

      if (
        logger === undefined ||
        !isSafeLogLevel(level) ||
        !isSafeTelemetryCode(eventName)
      ) {
        return false;
      }

      const context = options.currentContext();
      const turnId = getOwnDataValue(event, "turnId");
      const campaignHash = getOwnDataValue(event, "campaignHash");
      const durationMs = getOwnDataValue(event, "durationMs");
      const errorCode = getOwnDataValue(event, "errorCode");
      const record = {
        service: options.service,
        environment: options.environment,
        ...(context === undefined
          ? {}
          : {
              requestId: context.requestId,
              spanId: context.spanId,
              traceId: context.traceId,
            }),
        ...(isSafeTelemetryCode(turnId) ? { turnId } : {}),
        ...(isSafeTelemetryCode(campaignHash) ? { campaignHash } : {}),
        ...(isSafeDuration(durationMs) ? { durationMs } : {}),
        ...(isSafeTelemetryCode(errorCode) ? { errorCode } : {}),
      };

      try {
        writeLog(logger, level, record, eventName);
        return true;
      } catch {
        return false;
      }
    },
  });
}

export function isSafeTelemetryCode(input: unknown): input is string {
  if (
    typeof input !== "string" ||
    input.length === 0 ||
    input.length > MAX_LOG_CODE_LENGTH
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
      character === ":" ||
      character === "-";

    if (!isUppercase && !isLowercase && !isDigit && !isPunctuation) {
      return false;
    }
  }

  return true;
}

function createPinoLogger(
  destination: NodeLogDestination | undefined,
): Logger | undefined {
  const options: LoggerOptions = {
    base: null,
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
    level: "debug",
    messageKey: "event",
    redact: {
      censor: "[REDACTED]",
      paths: [
        "authorization",
        "cookie",
        "set-cookie",
        "password",
        "token",
        "apiKey",
        "dsn",
        "prompt",
        "narration",
        "output",
        "toolPayload",
        "user",
        "headers",
        "extra",
      ],
    },
    timestamp: () => `,"timestamp":${Date.now()}`,
  };

  try {
    return destination === undefined
      ? pino(options)
      : pino(options, destination);
  } catch {
    return undefined;
  }
}

function writeLog(
  logger: Logger,
  level: SafeLogLevel,
  record: Record<string, string | number>,
  event: string,
): void {
  switch (level) {
    case "debug":
      logger.debug(record, event);
      return;
    case "info":
      logger.info(record, event);
      return;
    case "warn":
      logger.warn(record, event);
      return;
    case "error":
      logger.error(record, event);
  }
}

function isSafeDuration(input: unknown): input is number {
  return typeof input === "number" && Number.isFinite(input) && input >= 0;
}

function isSafeLogLevel(input: unknown): input is SafeLogLevel {
  return (
    input === "debug" ||
    input === "info" ||
    input === "warn" ||
    input === "error"
  );
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
