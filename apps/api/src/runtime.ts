import {
  parseApiRuntimeConfig,
  type ApiRuntimeConfig,
  type EnvironmentSource,
} from "@dnd-ai/config";
import {
  createNodeObservability,
  type NodeObservability,
  type NodeObservabilityOptions,
} from "@dnd-ai/observability/node";
import type { FastifyInstance, FastifyServerOptions } from "fastify";

import { createApiApp } from "./app.js";
import { registerApiObservability } from "./observability.js";

type ApiAppFactory = (options?: FastifyServerOptions) => FastifyInstance;
type ApiObservabilityFactory = (
  options: NodeObservabilityOptions,
) => NodeObservability;

export interface CreateConfiguredApiAppOptions {
  readonly environment: EnvironmentSource;
  readonly createApp?: ApiAppFactory;
  readonly createObservability?: ApiObservabilityFactory;
  readonly fastifyOptions?: FastifyServerOptions;
  readonly shutdownTimeoutMs?: number;
}

export interface ConfiguredApiApp {
  readonly app: FastifyInstance;
  readonly config: ApiRuntimeConfig;
  readonly observability: NodeObservability;
}

export interface StartedApi extends ConfiguredApiApp {
  readonly address: string;
}

export function createConfiguredApiApp(
  options: CreateConfiguredApiAppOptions,
): ConfiguredApiApp {
  const config = parseApiRuntimeConfig(options.environment);
  const appFactory = options.createApp ?? createApiApp;
  const app = appFactory(options.fastifyOptions ?? {});
  const observabilityFactory =
    options.createObservability ?? createNodeObservability;
  let observability: NodeObservability | undefined;

  try {
    observability = observabilityFactory({
      environment: config.environment,
      service: "api",
      ...(config.sentryDsn === undefined
        ? {}
        : { sentryDsn: config.sentryDsn }),
    });
    registerApiObservability(app, observability, {
      ...(options.shutdownTimeoutMs === undefined
        ? {}
        : { shutdownTimeoutMs: options.shutdownTimeoutMs }),
    });
  } catch (error) {
    if (observability !== undefined) {
      void observability.shutdown(500).catch(() => false);
    }

    void app.close().catch(() => undefined);
    throw error;
  }

  return Object.freeze({ app, config, observability });
}

export async function startApi(
  options: CreateConfiguredApiAppOptions,
): Promise<StartedApi> {
  const runtime = createConfiguredApiApp(options);

  try {
    const address = await runtime.app.listen({
      host: runtime.config.host,
      port: runtime.config.port,
    });

    return Object.freeze({ ...runtime, address });
  } catch (error) {
    await runtime.app.close().catch(() => undefined);
    throw error;
  }
}
