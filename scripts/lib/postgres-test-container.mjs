import { execFile } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const CONTAINER_ID_PATTERN = /^[a-f0-9]{64}$/u;
const PUBLISHED_PORT_PATTERN = /^127\.0\.0\.1:(\d{1,5})$/u;
const DOCKER_COMMAND_TIMEOUT_MS = 120_000;
const HEALTH_COMMAND_TIMEOUT_MS = 2_000;
const HEALTH_POLL_INTERVAL_MS = 200;
const HEALTH_TIMEOUT_MS = 30_000;
const MAX_DOCKER_OUTPUT_BYTES = 64 * 1024;

export const POSTGRES_TEST_IMAGE =
  "pgvector/pgvector:0.8.2-pg17-trixie@sha256:5c97c57367a485a8e99389548db67d441ab1a878f5492c3df04989f34ecf3c75";

export const POSTGRES_TEST_DATABASE = "dnd_ai_test";
export const POSTGRES_TEST_USERNAME = "dnd_ai_migration_test";

const POSTGRES_TEST_PASSWORD = "local_test_only_password";

async function runDocker(arguments_, timeout = DOCKER_COMMAND_TIMEOUT_MS) {
  return execFileAsync("docker", arguments_, {
    encoding: "utf8",
    maxBuffer: MAX_DOCKER_OUTPUT_BYTES,
    timeout,
    windowsHide: true,
  });
}

function isMissingContainerError(error) {
  return (
    typeof error === "object" &&
    error !== null &&
    "stderr" in error &&
    typeof error.stderr === "string" &&
    /No such container:/iu.test(error.stderr)
  );
}

function parseContainerId(output) {
  const containerId = output.trim();

  if (!CONTAINER_ID_PATTERN.test(containerId)) {
    throw new Error("postgres-test-container: invalid-container-id");
  }

  return containerId;
}

function parsePublishedPort(output) {
  const mappings = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (mappings.length !== 1) {
    throw new Error("postgres-test-container: invalid-port-mapping");
  }

  const match = PUBLISHED_PORT_PATTERN.exec(mappings[0]);
  const port = match ? Number(match[1]) : Number.NaN;

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("postgres-test-container: invalid-port-mapping");
  }

  return port;
}

async function waitUntilHealthy(containerId) {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      await runDocker(
        [
          "exec",
          containerId,
          "pg_isready",
          "--host=127.0.0.1",
          "--port=5432",
          `--username=${POSTGRES_TEST_USERNAME}`,
          `--dbname=${POSTGRES_TEST_DATABASE}`,
          "--timeout=1",
        ],
        HEALTH_COMMAND_TIMEOUT_MS,
      );
      return;
    } catch {
      const remainingMs = deadline - Date.now();

      if (remainingMs > 0) {
        await delay(Math.min(HEALTH_POLL_INTERVAL_MS, remainingMs));
      }
    }
  }

  throw new Error("postgres-test-container: health-timeout");
}

export async function stopPostgresTestContainer(containerId) {
  if (!CONTAINER_ID_PATTERN.test(containerId)) {
    throw new Error("postgres-test-container: invalid-container-id");
  }

  try {
    await runDocker(["rm", "--force", containerId]);
  } catch (error) {
    // `docker run --rm` can remove a failed container before cleanup executes.
    if (isMissingContainerError(error)) {
      return;
    }

    throw new Error("postgres-test-container: teardown-failed");
  }
}

export async function startPostgresTestContainer() {
  let containerId;

  try {
    const started = await runDocker([
      "run",
      "--detach",
      "--rm",
      "--publish",
      "127.0.0.1::5432",
      "--tmpfs",
      "/var/lib/postgresql/data:rw,nosuid,size=512m",
      "--env",
      `POSTGRES_DB=${POSTGRES_TEST_DATABASE}`,
      "--env",
      `POSTGRES_USER=${POSTGRES_TEST_USERNAME}`,
      "--env",
      `POSTGRES_PASSWORD=${POSTGRES_TEST_PASSWORD}`,
      POSTGRES_TEST_IMAGE,
    ]);

    containerId = parseContainerId(started.stdout);

    const publishedPort = await runDocker(["port", containerId, "5432/tcp"]);
    const port = parsePublishedPort(publishedPort.stdout);

    await waitUntilHealthy(containerId);

    return Object.freeze({
      containerId,
      databaseUrl: `postgresql://${POSTGRES_TEST_USERNAME}:${POSTGRES_TEST_PASSWORD}@127.0.0.1:${port}/${POSTGRES_TEST_DATABASE}`,
      host: "127.0.0.1",
      image: POSTGRES_TEST_IMAGE,
      port,
      stop: () => stopPostgresTestContainer(containerId),
    });
  } catch {
    if (containerId) {
      await stopPostgresTestContainer(containerId);
    }

    throw new Error("postgres-test-container: start-failed");
  }
}

export async function withPostgresTestContainer(callback) {
  const postgres = await startPostgresTestContainer();

  try {
    return await callback(postgres);
  } finally {
    await postgres.stop();
  }
}
