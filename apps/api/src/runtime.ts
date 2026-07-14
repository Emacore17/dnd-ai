import {
  parseApiRuntimeConfig,
  type ApiRuntimeConfig,
  type EnvironmentSource,
} from "@dnd-ai/config";
import type { FastifyInstance, FastifyServerOptions } from "fastify";

import { createApiApp } from "./app.js";

type ApiAppFactory = (options?: FastifyServerOptions) => FastifyInstance;

export interface CreateConfiguredApiAppOptions {
  readonly environment: EnvironmentSource;
  readonly createApp?: ApiAppFactory;
  readonly fastifyOptions?: FastifyServerOptions;
}

export interface ConfiguredApiApp {
  readonly app: FastifyInstance;
  readonly config: ApiRuntimeConfig;
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

  return Object.freeze({ app, config });
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
