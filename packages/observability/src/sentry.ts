import * as Sentry from "@sentry/node";
import type { NodeOptions } from "@sentry/node";

import type {
  ErrorReporter,
  ObservabilityContext,
  SafeErrorMetadata,
} from "./contracts.js";
import { createNoopErrorReporter } from "./error-reporting.js";
import { createSentryErrorOnlyOptions } from "./sentry-options.js";

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
  const commonOptions = createSentryErrorOnlyOptions({
    environment: options.environment,
    ...(options.dsn === undefined ? {} : { dsn: options.dsn }),
    ...(options.release === undefined ? {} : { release: options.release }),
    ...(options.transport === undefined
      ? {}
      : { transport: options.transport }),
  });

  if (commonOptions === undefined) {
    return createNoopErrorReporter();
  }

  let client: ReturnType<typeof Sentry.initWithoutDefaultIntegrations>;

  try {
    client = Sentry.initWithoutDefaultIntegrations({
      ...commonOptions,
      registerEsmLoaderHooks: false,
      skipOpenTelemetrySetup: true,
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
