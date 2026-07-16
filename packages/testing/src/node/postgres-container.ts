import { createDockerContainerLifecycle } from "./docker-container.js";

export const POSTGRES_TEST_IMAGE =
  "pgvector/pgvector:0.8.2-pg17-trixie@sha256:5c97c57367a485a8e99389548db67d441ab1a878f5492c3df04989f34ecf3c75";
export const POSTGRES_TEST_DATABASE = "dnd_ai_test";
export const POSTGRES_TEST_USERNAME = "dnd_ai_migration_test";

const POSTGRES_TEST_PASSWORD = "local_test_only_password";
const lifecycle = createDockerContainerLifecycle();
const postgresSpec = Object.freeze({
  containerPort: 5432,
  image: POSTGRES_TEST_IMAGE,
  kind: "postgres" as const,
  pollIntervalMs: 200,
  readinessArguments: [
    "pg_isready",
    "--host=127.0.0.1",
    "--port=5432",
    `--username=${POSTGRES_TEST_USERNAME}`,
    `--dbname=${POSTGRES_TEST_DATABASE}`,
    "--timeout=1",
  ],
  readinessTimeoutMs: 30_000,
  runArguments: [
    "--tmpfs",
    "/var/lib/postgresql/data:rw,nosuid,size=512m",
    "--env",
    `POSTGRES_DB=${POSTGRES_TEST_DATABASE}`,
    "--env",
    `POSTGRES_USER=${POSTGRES_TEST_USERNAME}`,
    "--env",
    `POSTGRES_PASSWORD=${POSTGRES_TEST_PASSWORD}`,
  ],
});

function mapPostgresStopError(error: unknown): Error {
  return error instanceof Error &&
    error.message === "test-container: invalid-container-id"
    ? new Error("postgres-test-container: invalid-container-id")
    : new Error("postgres-test-container: teardown-failed");
}

export async function stopPostgresTestContainer(
  containerId: string,
): Promise<void> {
  try {
    await lifecycle.stop(containerId);
  } catch (error) {
    throw mapPostgresStopError(error);
  }
}

export async function startPostgresTestContainer() {
  try {
    const container = await lifecycle.start(postgresSpec);
    const { containerId, host, image, port } = container;

    return Object.freeze({
      containerId,
      databaseUrl: `postgresql://${POSTGRES_TEST_USERNAME}:${POSTGRES_TEST_PASSWORD}@${host}:${port}/${POSTGRES_TEST_DATABASE}`,
      host,
      image,
      port,
      stop: () => stopPostgresTestContainer(containerId),
    });
  } catch {
    throw new Error("postgres-test-container: start-failed");
  }
}

export async function withPostgresTestContainer<T>(
  callback: (
    postgres: Awaited<ReturnType<typeof startPostgresTestContainer>>,
  ) => Promise<T>,
): Promise<T> {
  const postgres = await startPostgresTestContainer();

  try {
    return await callback(postgres);
  } finally {
    await postgres.stop();
  }
}
