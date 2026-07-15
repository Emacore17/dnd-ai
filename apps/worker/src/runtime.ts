import {
  parseWorkerRuntimeConfig,
  type EnvironmentSource,
  type WorkerRuntimeConfig,
} from "@dnd-ai/config";
import {
  createNodeObservability,
  type NodeObservability,
  type NodeObservabilityOptions,
} from "@dnd-ai/observability/node";

type WorkerObservabilityFactory = (
  options: NodeObservabilityOptions,
) => NodeObservability;

export interface InitializeWorkerRuntimeOptions<Result> {
  readonly environment: EnvironmentSource;
  readonly initialize: (
    config: WorkerRuntimeConfig,
    observability: NodeObservability,
  ) => Promise<Result>;
  readonly createObservability?: WorkerObservabilityFactory;
  readonly shutdownTimeoutMs?: number;
}

export async function initializeWorkerRuntime<Result>(
  options: InitializeWorkerRuntimeOptions<Result>,
): Promise<Result> {
  const config = parseWorkerRuntimeConfig(options.environment);
  const observabilityFactory =
    options.createObservability ?? createNodeObservability;
  const observability = observabilityFactory({
    environment: config.environment,
    service: "worker",
    ...(config.sentryDsn === undefined ? {} : { sentryDsn: config.sentryDsn }),
  });

  try {
    return await options.initialize(config, observability);
  } catch (error) {
    const timeoutMs =
      Number.isSafeInteger(options.shutdownTimeoutMs) &&
      typeof options.shutdownTimeoutMs === "number" &&
      options.shutdownTimeoutMs > 0
        ? options.shutdownTimeoutMs
        : 500;
    await observability.shutdown(timeoutMs).catch(() => false);
    throw error;
  }
}
