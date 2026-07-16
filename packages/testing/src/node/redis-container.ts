import type { DockerContainerLifecycle } from "./docker-container.js";
import { createDockerContainerLifecycle } from "./docker-container.js";

export const REDIS_TEST_IMAGE =
  "redis:7.4.7-alpine3.21@sha256:02f2cc4882f8bf87c79a220ac958f58c700bdec0dfb9b9ea61b62fb0e8f1bfcf";

const redisSpec = Object.freeze({
  commandArguments: ["--save", "", "--appendonly", "no"],
  containerPort: 6379,
  image: REDIS_TEST_IMAGE,
  kind: "redis" as const,
  pollIntervalMs: 100,
  readinessArguments: ["redis-cli", "--raw", "PING"],
  readinessTimeoutMs: 30_000,
  runArguments: ["--tmpfs", "/data:rw,nosuid,size=64m"],
});

function mapRedisStopError(error: unknown): Error {
  return error instanceof Error &&
    error.message === "test-container: invalid-container-id"
    ? new Error("redis-test-container: invalid-container-id")
    : new Error("redis-test-container: teardown-failed");
}

export function createRedisTestContainerHarness(
  lifecycle: DockerContainerLifecycle,
) {
  async function stop(containerId: string): Promise<void> {
    try {
      await lifecycle.stop(containerId);
    } catch (error) {
      throw mapRedisStopError(error);
    }
  }

  async function start() {
    try {
      const container = await lifecycle.start(redisSpec);
      const { containerId, host, image, port } = container;

      return Object.freeze({
        containerId,
        host,
        image,
        port,
        redisUrl: `redis://${host}:${port}/0`,
        stop: () => stop(containerId),
      });
    } catch {
      throw new Error("redis-test-container: start-failed");
    }
  }

  async function withContainer<T>(
    callback: (redis: Awaited<ReturnType<typeof start>>) => Promise<T>,
  ): Promise<T> {
    const redis = await start();

    try {
      return await callback(redis);
    } finally {
      await redis.stop();
    }
  }

  return Object.freeze({ start, stop, withContainer });
}

const defaultHarness = createRedisTestContainerHarness(
  createDockerContainerLifecycle(),
);

export const stopRedisTestContainer = defaultHarness.stop;
export const startRedisTestContainer = defaultHarness.start;
export const withRedisTestContainer = defaultHarness.withContainer;
