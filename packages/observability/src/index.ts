// Keep the root entry point platform-neutral; Node adapters live in ./node.
export type {
  ErrorReporter,
  ObservabilityContext,
  ObservabilityService,
  SafeErrorMetadata,
  SafeLogEvent,
  TraceCarrier,
} from "./contracts.js";
export { createNoopErrorReporter } from "./error-reporting.js";
export type { SanitizedSentryEvent } from "./redaction.js";
export { sanitizeSentryEvent, sanitizeTelemetryValue } from "./redaction.js";
export { createRequestId } from "./request-id.js";
