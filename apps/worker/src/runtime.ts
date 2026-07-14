import {
  parseWorkerRuntimeConfig,
  type EnvironmentSource,
  type WorkerRuntimeConfig,
} from "@dnd-ai/config";

export interface InitializeWorkerRuntimeOptions<Result> {
  readonly environment: EnvironmentSource;
  readonly initialize: (config: WorkerRuntimeConfig) => Promise<Result>;
}

export async function initializeWorkerRuntime<Result>(
  options: InitializeWorkerRuntimeOptions<Result>,
): Promise<Result> {
  const config = parseWorkerRuntimeConfig(options.environment);
  return options.initialize(config);
}
