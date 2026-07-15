import {
  createSentryErrorOnlyOptions,
  initializeSentryErrorOnly,
  type SentryErrorOnlyConfiguration,
  type SentryErrorOnlyOptions,
} from "@dnd-ai/observability";

export type WebRuntimeEnvironment = "local" | "staging" | "production";

interface EnvironmentSource {
  readonly appEnvironment?: string | undefined;
  readonly nodeEnvironment?: string | undefined;
  readonly vercelEnvironment?: string | undefined;
}

export function createWebSentryOptions<Transport = never>(
  configuration: SentryErrorOnlyConfiguration<Transport>,
): SentryErrorOnlyOptions<Transport> | undefined {
  return createSentryErrorOnlyOptions(configuration);
}

export function initializeWebSentry<Transport = never>(
  initialize: (options: SentryErrorOnlyOptions<Transport>) => unknown,
  configuration: SentryErrorOnlyConfiguration<Transport>,
): boolean {
  return initializeSentryErrorOnly(initialize, configuration);
}

export function resolveWebRuntimeEnvironment(
  source: EnvironmentSource,
): WebRuntimeEnvironment {
  if (
    source.appEnvironment === "local" ||
    source.appEnvironment === "staging" ||
    source.appEnvironment === "production"
  ) {
    return source.appEnvironment;
  }

  if (source.vercelEnvironment === "production") {
    return "production";
  }

  if (source.vercelEnvironment === "preview") {
    return "staging";
  }

  return source.nodeEnvironment === "production" ? "production" : "local";
}
