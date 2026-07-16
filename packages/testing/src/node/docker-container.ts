import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const DOCKER_COMMAND_TIMEOUT_MS = 120_000;
const READINESS_COMMAND_TIMEOUT_MS = 2_000;
const MAX_DOCKER_OUTPUT_BYTES = 64 * 1024;

export interface DockerCommandResult {
  readonly stderr: string;
  readonly stdout: string;
}

export type DockerCommandRunner = (
  arguments_: readonly string[],
  timeoutMs: number,
) => Promise<DockerCommandResult>;

export interface DockerContainerSpec {
  readonly commandArguments?: readonly string[];
  readonly containerPort: number;
  readonly image: string;
  readonly kind: "postgres" | "redis";
  readonly pollIntervalMs: number;
  readonly readinessArguments: readonly string[];
  readonly readinessTimeoutMs: number;
  readonly runArguments: readonly string[];
}

export interface DockerTestContainer {
  readonly containerId: string;
  readonly host: "127.0.0.1";
  readonly image: string;
  readonly port: number;
  stop(): Promise<void>;
}

export interface DockerContainerLifecycle {
  start(spec: DockerContainerSpec): Promise<DockerTestContainer>;
  stop(containerId: string): Promise<void>;
}

export interface DockerContainerLifecycleDependencies {
  readonly delay?: (milliseconds: number) => Promise<void>;
  readonly now?: () => number;
  readonly randomId?: () => string;
  readonly runDocker?: DockerCommandRunner;
}

function hasExactLowercaseHex(value: string, length: number): boolean {
  return (
    value.length === length &&
    [...value].every(
      (character) =>
        (character >= "0" && character <= "9") ||
        (character >= "a" && character <= "f"),
    )
  );
}

function isContainerId(value: string): boolean {
  return hasExactLowercaseHex(value, 64);
}

function isMissingContainerError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "stderr" in error &&
    typeof error.stderr === "string" &&
    error.stderr.includes("No such container:")
  );
}

function parseContainerId(output: string): string {
  const containerId = output.trim();

  if (!isContainerId(containerId)) {
    throw new Error("test-container: invalid-container-id");
  }

  return containerId;
}

function parsePublishedPort(output: string): number {
  const mappings = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const prefix = "127.0.0.1:";
  const mapping = mappings[0];

  if (
    mappings.length !== 1 ||
    mapping === undefined ||
    !mapping.startsWith(prefix)
  ) {
    throw new Error("test-container: invalid-port-mapping");
  }

  const source = mapping.slice(prefix.length);
  if (
    source.length === 0 ||
    ![...source].every((character) => character >= "0" && character <= "9")
  ) {
    throw new Error("test-container: invalid-port-mapping");
  }

  const port = Number(source);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("test-container: invalid-port-mapping");
  }

  return port;
}

function validateSpec(spec: DockerContainerSpec): void {
  const digestSeparator = spec.image.lastIndexOf("@sha256:");
  const digest = spec.image.slice(digestSeparator + "@sha256:".length);

  if (
    !["postgres", "redis"].includes(spec.kind) ||
    !Number.isInteger(spec.containerPort) ||
    spec.containerPort < 1 ||
    spec.containerPort > 65_535 ||
    digestSeparator < 1 ||
    !hasExactLowercaseHex(digest, 64) ||
    !Number.isSafeInteger(spec.pollIntervalMs) ||
    spec.pollIntervalMs < 1 ||
    !Number.isSafeInteger(spec.readinessTimeoutMs) ||
    spec.readinessTimeoutMs < spec.pollIntervalMs ||
    spec.readinessArguments.length === 0
  ) {
    throw new Error("test-container: invalid-spec");
  }
}

function createContainerName(kind: string, identifier: string): string {
  const normalized = identifier.replaceAll("-", "").toLowerCase();

  if (!hasExactLowercaseHex(normalized, 32)) {
    throw new Error("test-container: invalid-random-id");
  }

  return `dnd-ai-test-${kind}-${normalized}`;
}

function defaultRunDocker(
  arguments_: readonly string[],
  timeoutMs: number,
): Promise<DockerCommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      "docker",
      [...arguments_],
      {
        encoding: "utf8",
        maxBuffer: MAX_DOCKER_OUTPUT_BYTES,
        timeout: timeoutMs,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(Object.assign(error, { stderr }));
          return;
        }

        resolve({ stderr, stdout });
      },
    );
  });
}

function isTestContainerError(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith("test-container:");
}

export function createDockerContainerLifecycle(
  dependencies: DockerContainerLifecycleDependencies = {},
): DockerContainerLifecycle {
  const wait = dependencies.delay ?? delay;
  const now = dependencies.now ?? Date.now;
  const createRandomId = dependencies.randomId ?? randomUUID;
  const runDocker = dependencies.runDocker ?? defaultRunDocker;

  async function stop(containerId: string): Promise<void> {
    if (!isContainerId(containerId)) {
      throw new Error("test-container: invalid-container-id");
    }

    try {
      await runDocker(
        ["rm", "--force", containerId],
        DOCKER_COMMAND_TIMEOUT_MS,
      );
    } catch (error) {
      if (!isMissingContainerError(error)) {
        throw new Error("test-container: cleanup-failed");
      }
    }
  }

  async function waitUntilReady(
    containerId: string,
    spec: DockerContainerSpec,
  ): Promise<void> {
    const deadline = now() + spec.readinessTimeoutMs;

    while (now() < deadline) {
      try {
        await runDocker(
          ["exec", containerId, ...spec.readinessArguments],
          READINESS_COMMAND_TIMEOUT_MS,
        );
        return;
      } catch {
        const remainingMs = deadline - now();
        if (remainingMs > 0) {
          await wait(Math.min(spec.pollIntervalMs, remainingMs));
        }
      }
    }

    throw new Error("test-container: readiness-timeout");
  }

  async function start(
    spec: DockerContainerSpec,
  ): Promise<DockerTestContainer> {
    validateSpec(spec);
    const containerName = createContainerName(spec.kind, createRandomId());
    let containerId: string | undefined;

    try {
      const started = await runDocker(
        [
          "run",
          "--detach",
          "--rm",
          "--name",
          containerName,
          "--publish",
          `127.0.0.1::${spec.containerPort}`,
          ...spec.runArguments,
          spec.image,
          ...(spec.commandArguments ?? []),
        ],
        DOCKER_COMMAND_TIMEOUT_MS,
      );
      const startedContainerId = parseContainerId(started.stdout);
      containerId = startedContainerId;
      const publishedPort = await runDocker(
        ["port", startedContainerId, `${spec.containerPort}/tcp`],
        DOCKER_COMMAND_TIMEOUT_MS,
      );
      const port = parsePublishedPort(publishedPort.stdout);
      await waitUntilReady(startedContainerId, spec);

      return Object.freeze({
        containerId: startedContainerId,
        host: "127.0.0.1" as const,
        image: spec.image,
        port,
        stop: () => stop(startedContainerId),
      });
    } catch (error) {
      if (containerId !== undefined) {
        try {
          await stop(containerId);
        } catch {
          throw new Error("test-container: cleanup-failed");
        }
      }

      if (isTestContainerError(error)) {
        throw error;
      }

      throw new Error("test-container: start-failed");
    }
  }

  return Object.freeze({ start, stop });
}
