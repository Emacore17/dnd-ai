import { randomBytes } from "node:crypto";

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
import {
  createPostgresCampaignAccessStore,
  createPostgresIdentityAccessStore,
  createPostgresIdentityStore,
} from "@dnd-ai/persistence";
import type { FastifyInstance, FastifyServerOptions } from "fastify";

import { createApiApp, type ApiAppDependencies } from "./app.js";
import { createCampaignAccessService } from "./campaign/campaign-access-service.js";
import {
  registerCampaignRoutes,
  type RegisterCampaignRoutesOptions,
} from "./campaign/routes.js";
import { createNodeIdentityCryptography } from "./identity/identity-crypto.js";
import {
  createIdentityAccessService,
  type IdentityAccessService,
} from "./identity/identity-access-service.js";
import {
  verifyIdentityClientSubjectAssertion,
  type IdentityClientSubjectAssertion,
} from "./identity/client-subject-assertion.js";
import { createIdentityService } from "./identity/identity-service.js";
import { loadCommonPasswordBlocklist } from "./identity/password-blocklist.js";
import { createArgon2PasswordHasher } from "./identity/password-hasher.js";
import {
  registerIdentityRoutes,
  type RegisterIdentityRoutesOptions,
} from "./identity/routes.js";
import {
  registerIdentityAccessRoutes,
  type RegisterIdentityAccessRoutesOptions,
} from "./identity/access-routes.js";
import { registerApiObservability } from "./observability.js";

type ApiAppFactory = (
  options?: FastifyServerOptions,
  dependencies?: ApiAppDependencies,
) => FastifyInstance;
type ApiObservabilityFactory = (
  options: NodeObservabilityOptions,
) => NodeObservability;

export interface ApiIdentityRuntime {
  readonly routes: RegisterIdentityRoutesOptions;
  readonly accessRoutes?: RegisterIdentityAccessRoutesOptions;
  readonly campaignRoutes?: RegisterCampaignRoutesOptions;
  close(): Promise<void>;
}

type ApiIdentityRuntimeFactory = (
  config: ApiRuntimeConfig,
) => Promise<ApiIdentityRuntime>;

export interface CreateConfiguredApiAppOptions {
  readonly environment: EnvironmentSource;
  readonly createApp?: ApiAppFactory;
  readonly createObservability?: ApiObservabilityFactory;
  readonly createIdentityRuntime?: ApiIdentityRuntimeFactory;
  readonly fastifyOptions?: FastifyServerOptions;
  readonly identityRuntime?: ApiIdentityRuntime;
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

export async function createApiIdentityRuntime(
  config: ApiRuntimeConfig,
): Promise<ApiIdentityRuntime> {
  const store = createPostgresIdentityStore({
    databaseUrl: config.databaseUrl,
  });
  const accessStore = createPostgresIdentityAccessStore({
    databaseUrl: config.databaseUrl,
  });
  const campaignAccessStore = createPostgresCampaignAccessStore({
    databaseUrl: config.databaseUrl,
  });
  let closePromise: Promise<void> | undefined;
  const close = (): Promise<void> => {
    closePromise ??= Promise.all([
      store.close(),
      accessStore.close(),
      campaignAccessStore.close(),
    ]).then(() => undefined);
    return closePromise;
  };
  try {
    const blocklist = await loadCommonPasswordBlocklist();
    const cryptography = createNodeIdentityCryptography({
      challengeKey: config.identity.challenge.key,
      challengeKeyVersion: config.identity.challenge.version,
      randomBytes: (length) => randomBytes(length),
      resetChallengeKey: config.identity.reset.key,
      resetChallengeKeyVersion: config.identity.reset.version,
      sessionKey: config.identity.session.key,
      sessionKeyVersion: config.identity.session.version,
      subjectHashKey: config.identity.subjectHashKey,
    });
    const passwordHasher = createArgon2PasswordHasher({
      pepper: config.identity.passwordPepper.key,
      pepperVersion: config.identity.passwordPepper.version,
    });
    const service = createIdentityService({
      blocklist,
      clock: Object.freeze({ now: () => new Date() }),
      cryptography,
      passwordHasher,
      store,
    });
    const accessService: IdentityAccessService = createIdentityAccessService({
      blocklist,
      clock: Object.freeze({ now: () => new Date() }),
      cryptography,
      dummyPasswordHash: await passwordHasher.hash(
        "dnd-ai-uniform-dummy-credential-v1",
      ),
      passwordHasher,
      store: accessStore,
    });
    const campaignService = createCampaignAccessService({
      campaignReader: campaignAccessStore,
      clock: Object.freeze({ now: () => new Date() }),
      cryptography,
      sessionReader: campaignAccessStore,
    });
    const verifyClientSubject = (
      assertion: IdentityClientSubjectAssertion,
      now: Date,
    ): string | null =>
      verifyIdentityClientSubjectAssertion(assertion, {
        key: config.identity.bffAssertionKey,
        now,
      });
    return Object.freeze({
      accessRoutes: Object.freeze({
        clock: Object.freeze({ now: () => new Date() }),
        publicOrigin: config.publicOrigin,
        service: accessService,
        verifyClientSubjectAssertion: verifyClientSubject,
      }),
      campaignRoutes: Object.freeze({ service: campaignService }),
      close,
      routes: Object.freeze({
        clock: Object.freeze({ now: () => new Date() }),
        publicOrigin: config.publicOrigin,
        service,
        verifyClientSubjectAssertion: verifyClientSubject,
      }),
    });
  } catch (error) {
    await close().catch(() => undefined);
    throw error;
  }
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
    if (options.identityRuntime !== undefined) {
      registerIdentityRoutes(app, options.identityRuntime.routes);
      if (options.identityRuntime.accessRoutes !== undefined) {
        registerIdentityAccessRoutes(app, options.identityRuntime.accessRoutes);
      }
      if (options.identityRuntime.campaignRoutes !== undefined) {
        registerCampaignRoutes(app, options.identityRuntime.campaignRoutes);
      }
      app.addHook("onClose", async () => options.identityRuntime?.close());
    }
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
  const config = parseApiRuntimeConfig(options.environment);
  const identityRuntime =
    options.identityRuntime ??
    (await (options.createIdentityRuntime ?? createApiIdentityRuntime)(config));
  let runtime: ConfiguredApiApp;

  try {
    runtime = createConfiguredApiApp({ ...options, identityRuntime });
  } catch (error) {
    await identityRuntime.close().catch(() => undefined);
    throw error;
  }

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
