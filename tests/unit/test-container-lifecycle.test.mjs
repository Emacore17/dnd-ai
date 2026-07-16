import assert from "node:assert/strict";
import test from "node:test";

import {
  POSTGRES_TEST_IMAGE,
  REDIS_TEST_IMAGE,
  createDockerContainerLifecycle,
} from "../../packages/testing/dist/node/index.js";

const CONTAINER_ID = "a".repeat(64);
const REDIS_SPEC = Object.freeze({
  containerPort: 6379,
  image: REDIS_TEST_IMAGE,
  kind: "redis",
  pollIntervalMs: 10,
  readinessArguments: ["redis-cli", "PING"],
  readinessTimeoutMs: 100,
  runArguments: ["--tmpfs", "/data:rw,nosuid,size=64m"],
});

function dockerError(stderr) {
  return Object.assign(new Error("docker failed"), { stderr });
}

function createDependencies(runDocker) {
  let currentTime = 0;

  return {
    delay: async (milliseconds) => {
      currentTime += milliseconds;
    },
    now: () => currentTime,
    randomId: () => "00000000-0000-4000-8000-000000000001",
    runDocker,
  };
}

test("QA-001:docker-lifecycle-starts-readies-and-stops-a-loopback-container", async () => {
  const calls = [];
  const lifecycle = createDockerContainerLifecycle(
    createDependencies(async (arguments_) => {
      calls.push(arguments_);

      if (arguments_[0] === "run") {
        return { stderr: "", stdout: `${CONTAINER_ID}\n` };
      }
      if (arguments_[0] === "port") {
        return { stderr: "", stdout: "127.0.0.1:49152\n" };
      }

      return { stderr: "", stdout: "PONG\n" };
    }),
  );

  const container = await lifecycle.start(REDIS_SPEC);

  assert.equal(Object.isFrozen(container), true);
  assert.deepEqual(
    {
      containerId: container.containerId,
      host: container.host,
      image: container.image,
      port: container.port,
    },
    {
      containerId: CONTAINER_ID,
      host: "127.0.0.1",
      image: REDIS_TEST_IMAGE,
      port: 49152,
    },
  );
  assert.deepEqual(calls[0].slice(0, 8), [
    "run",
    "--detach",
    "--rm",
    "--name",
    "dnd-ai-test-redis-00000000000040008000000000000001",
    "--publish",
    "127.0.0.1::6379",
    "--tmpfs",
  ]);
  assert.deepEqual(calls.at(-1), ["exec", CONTAINER_ID, "redis-cli", "PING"]);

  await container.stop();
  assert.deepEqual(calls.at(-1), ["rm", "--force", CONTAINER_ID]);
});

test("QA-001:docker-lifecycle-cleans-up-after-readiness-timeout", async () => {
  const calls = [];
  const lifecycle = createDockerContainerLifecycle(
    createDependencies(async (arguments_) => {
      calls.push(arguments_);

      if (arguments_[0] === "run") {
        return { stderr: "", stdout: CONTAINER_ID };
      }
      if (arguments_[0] === "port") {
        return { stderr: "", stdout: "127.0.0.1:49153" };
      }
      if (arguments_[0] === "exec") {
        throw dockerError("not ready");
      }

      return { stderr: "", stdout: "" };
    }),
  );

  await assert.rejects(
    lifecycle.start(REDIS_SPEC),
    /test-container: readiness-timeout/u,
  );
  assert.deepEqual(calls.at(-1), ["rm", "--force", CONTAINER_ID]);
});

test("QA-001:docker-lifecycle-surfaces-cleanup-failure", async () => {
  const lifecycle = createDockerContainerLifecycle(
    createDependencies(async (arguments_) => {
      if (arguments_[0] === "run") {
        return { stderr: "", stdout: CONTAINER_ID };
      }
      if (arguments_[0] === "port") {
        return { stderr: "", stdout: "127.0.0.1:49154" };
      }
      if (arguments_[0] === "rm") {
        throw dockerError("permission denied");
      }

      throw dockerError("not ready");
    }),
  );

  await assert.rejects(
    lifecycle.start(REDIS_SPEC),
    /test-container: cleanup-failed/u,
  );
});

test("QA-001:docker-lifecycle-validates-output-and-idempotent-missing-cleanup", async () => {
  const lifecycle = createDockerContainerLifecycle(
    createDependencies(async (arguments_) => {
      if (arguments_[0] === "run") {
        return { stderr: "", stdout: CONTAINER_ID };
      }
      if (arguments_[0] === "port") {
        return { stderr: "", stdout: "0.0.0.0:49155" };
      }
      if (arguments_[0] === "rm") {
        throw dockerError(`Error: No such container: ${CONTAINER_ID}`);
      }

      return { stderr: "", stdout: "" };
    }),
  );

  await assert.rejects(
    lifecycle.start(REDIS_SPEC),
    /test-container: invalid-port-mapping/u,
  );
  await lifecycle.stop(CONTAINER_ID);
  await assert.rejects(
    lifecycle.stop("not-a-container-id"),
    /test-container: invalid-container-id/u,
  );
});

test("QA-001:container-images-are-immutable-digests", () => {
  assert.match(
    POSTGRES_TEST_IMAGE,
    /^pgvector\/pgvector:[^@]+@sha256:[a-f0-9]{64}$/u,
  );
  assert.equal(
    REDIS_TEST_IMAGE,
    "redis:7.4.7-alpine3.21@sha256:02f2cc4882f8bf87c79a220ac958f58c700bdec0dfb9b9ea61b62fb0e8f1bfcf",
  );
});
