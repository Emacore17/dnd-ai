import { randomInt, randomUUID } from "node:crypto";

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

import {
  dispatchIdentityEmailBatch,
  type DispatchSummary,
  type IdentityEmailOutbox,
} from "./identity/outbox-dispatcher.js";
import {
  createFakeVerificationEmailSender,
  type VerificationEmailSender,
} from "./identity/email-sender.js";
import { createPostgresIdentityEmailOutbox } from "./identity/postgres-outbox.js";
import { createSmtpVerificationEmailSender } from "./identity/smtp-email-sender.js";

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

export interface WorkerIdentityRuntime {
  dispatch(signal?: AbortSignal): Promise<DispatchSummary>;
  close(): Promise<void>;
}

export interface CreateWorkerIdentityRuntimeOptions {
  readonly clock?: Readonly<{ now(): Date }>;
  readonly createOutbox?: (config: WorkerRuntimeConfig) => IdentityEmailOutbox;
  readonly createSender?: (
    config: WorkerRuntimeConfig,
  ) => VerificationEmailSender;
  readonly jitterMs?: () => number;
}

function configuredSender(
  config: WorkerRuntimeConfig,
): VerificationEmailSender {
  if (config.emailDelivery.mode === "fake") {
    return createFakeVerificationEmailSender();
  }
  return createSmtpVerificationEmailSender(config.emailDelivery);
}

export function createWorkerIdentityRuntime(
  config: WorkerRuntimeConfig,
  options: CreateWorkerIdentityRuntimeOptions = {},
): WorkerIdentityRuntime {
  const outbox = (
    options.createOutbox ??
    ((runtimeConfig) =>
      createPostgresIdentityEmailOutbox({
        createLeaseToken: randomUUID,
        databaseUrl: runtimeConfig.databaseUrl,
      }))
  )(config);
  let sender: VerificationEmailSender;

  try {
    sender = (options.createSender ?? configuredSender)(config);
  } catch (error) {
    void outbox.close?.().catch(() => undefined);
    throw error;
  }

  const clock = options.clock ?? Object.freeze({ now: () => new Date() });
  const jitterMs = options.jitterMs ?? (() => randomInt(0, 1_001));
  let closePromise: Promise<void> | undefined;

  return Object.freeze({
    dispatch(signal?: AbortSignal): Promise<DispatchSummary> {
      return dispatchIdentityEmailBatch({
        challengeKey: config.identity.challenge.key,
        challengeKeyVersion: config.identity.challenge.version,
        clock,
        jitterMs,
        outbox,
        resetKey: config.identity.reset.key,
        resetKeyVersion: config.identity.reset.version,
        sender,
        ...(signal === undefined ? {} : { signal }),
      });
    },
    close(): Promise<void> {
      closePromise ??= Promise.all([
        outbox.close?.() ?? Promise.resolve(),
        sender.close?.() ?? Promise.resolve(),
      ]).then(() => undefined);
      return closePromise;
    },
  });
}

export type WorkerPollerWait = (
  durationMs: number,
  signal: AbortSignal,
) => Promise<void>;

function waitForPoll(durationMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = (): void => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timeout = setTimeout(finish, durationMs);
    signal.addEventListener("abort", finish, { once: true });
  });
}

export interface RunIdentityEmailPollerOptions {
  readonly dispatchTick: (signal: AbortSignal) => Promise<unknown>;
  readonly signal: AbortSignal;
  readonly wait?: WorkerPollerWait;
}

export async function runIdentityEmailPoller(
  options: RunIdentityEmailPollerOptions,
): Promise<void> {
  const wait = options.wait ?? waitForPoll;
  while (!options.signal.aborted) {
    await options.dispatchTick(options.signal);
    if (!options.signal.aborted) await wait(2_000, options.signal);
  }
}

type WorkerIdentityRuntimeFactory = (
  config: WorkerRuntimeConfig,
) => Promise<WorkerIdentityRuntime> | WorkerIdentityRuntime;

export interface StartWorkerOptions {
  readonly environment: EnvironmentSource;
  readonly createIdentityRuntime?: WorkerIdentityRuntimeFactory;
  readonly createObservability?: WorkerObservabilityFactory;
  readonly shutdownTimeoutMs?: number;
  readonly wait?: WorkerPollerWait;
}

export interface StartedWorker {
  readonly completion: Promise<void>;
  readonly config: WorkerRuntimeConfig;
  readonly observability: NodeObservability;
  stop(): Promise<void>;
}

export function startWorker(
  options: StartWorkerOptions,
): Promise<StartedWorker> {
  return initializeWorkerRuntime({
    ...(options.createObservability === undefined
      ? {}
      : { createObservability: options.createObservability }),
    environment: options.environment,
    initialize: async (config, observability) => {
      const identity = await (
        options.createIdentityRuntime ?? createWorkerIdentityRuntime
      )(config);
      const controller = new AbortController();
      const completion = runIdentityEmailPoller({
        dispatchTick: (signal) => identity.dispatch(signal),
        signal: controller.signal,
        ...(options.wait === undefined ? {} : { wait: options.wait }),
      });
      let stopPromise: Promise<void> | undefined;

      return Object.freeze({
        completion,
        config,
        observability,
        stop(): Promise<void> {
          stopPromise ??= (async () => {
            controller.abort();
            await completion.catch(() => undefined);
            await identity.close();
            await observability.shutdown(options.shutdownTimeoutMs ?? 500);
          })();
          return stopPromise;
        },
      });
    },
    ...(options.shutdownTimeoutMs === undefined
      ? {}
      : { shutdownTimeoutMs: options.shutdownTimeoutMs }),
  });
}
