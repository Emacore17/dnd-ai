import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import { createConfiguredApiApp, startApi } from "../../apps/api/dist/index.js";
import { initializeWorkerRuntime } from "../../apps/worker/dist/index.js";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const configCliPath = path.join(
  repositoryRoot,
  "packages",
  "config",
  "dist",
  "cli.js",
);
const apiStartPath = path.join(
  repositoryRoot,
  "apps",
  "api",
  "dist",
  "start.js",
);
const managedKeys = [
  "APP_ENV",
  "API_HOST",
  "API_PORT",
  "API_DATABASE_URL",
  "API_REDIS_URL",
  "API_SENTRY_DSN",
  "WORKER_DATABASE_URL",
  "WORKER_REDIS_URL",
  "WORKER_SENTRY_DSN",
  "MIGRATION_DATABASE_URL",
];

function isolatedEnvironment(values = {}) {
  const environment = { ...process.env };

  for (const key of managedKeys) {
    delete environment[key];
  }

  return { ...environment, ...values };
}

async function reserveAvailablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return address.port;
}

function apiEnvironment(port) {
  return {
    APP_ENV: "local",
    API_HOST: "127.0.0.1",
    API_PORT: String(port),
    API_DATABASE_URL: "postgresql://dnd_api_local@127.0.0.1:5432/dnd_ai_local",
    API_REDIS_URL: "redis://127.0.0.1:6379/0",
  };
}

test("API validation runs before application construction or socket binding", () => {
  let appFactoryCalled = false;
  let observabilityFactoryCalled = false;

  assert.throws(() =>
    createConfiguredApiApp({
      environment: {},
      createObservability: () => {
        observabilityFactoryCalled = true;
        throw new Error("must not be reached");
      },
      createApp: () => {
        appFactoryCalled = true;
        throw new Error("must not be reached");
      },
    }),
  );
  assert.equal(appFactoryCalled, false);
  assert.equal(observabilityFactoryCalled, false);
});

test("a valid API profile binds and can be closed cleanly", async (context) => {
  const port = await reserveAvailablePort();
  const runtime = await startApi({ environment: apiEnvironment(port) });
  context.after(() => runtime.app.close());

  assert.equal(runtime.config.environment, "local");
  assert.match(runtime.address, new RegExp(`:${port}$`));
});

test("worker validation runs before the injected initializer", async () => {
  let initializerCalled = false;
  let observabilityFactoryCalled = false;

  await assert.rejects(
    initializeWorkerRuntime({
      environment: { APP_ENV: "staging" },
      createObservability: () => {
        observabilityFactoryCalled = true;
        throw new Error("must not be reached");
      },
      initialize: async () => {
        initializerCalled = true;
      },
    }),
  );
  assert.equal(initializerCalled, false);
  assert.equal(observabilityFactoryCalled, false);

  const fakeObservability = Object.freeze({ name: "worker-observability" });

  const result = await initializeWorkerRuntime({
    environment: {
      APP_ENV: "staging",
      WORKER_DATABASE_URL:
        "postgresql://worker_user:worker_password@staging-db.internal:5432/dnd_ai?sslmode=require",
      WORKER_REDIS_URL:
        "rediss://worker:redis_password@staging-cache.internal:6380/1",
    },
    createObservability: (options) => {
      assert.equal(options.environment, "staging");
      assert.equal(options.service, "worker");
      return fakeObservability;
    },
    initialize: async (config, observability) => {
      assert.equal(observability, fakeObservability);
      return config.environment;
    },
  });
  assert.equal(result, "staging");
});

test("malformed Sentry DSNs fail before API construction and worker initialization", async () => {
  const apiSecretDsn = "http://api-canary@errors.example.test/101";
  let appFactoryCalled = false;

  assert.throws(
    () =>
      createConfiguredApiApp({
        environment: {
          ...apiEnvironment(3001),
          API_SENTRY_DSN: apiSecretDsn,
        },
        createApp: () => {
          appFactoryCalled = true;
          throw new Error("must not be reached");
        },
      }),
    (error) => {
      assert.deepEqual(error.invalidKeys, ["API_SENTRY_DSN"]);
      assert.doesNotMatch(error.message, new RegExp(apiSecretDsn));
      return true;
    },
  );
  assert.equal(appFactoryCalled, false);

  const workerSecretDsn = "https://worker-canary@bad_host/202";
  let initializerCalled = false;

  await assert.rejects(
    initializeWorkerRuntime({
      environment: {
        APP_ENV: "staging",
        WORKER_DATABASE_URL:
          "postgresql://worker_user:worker_password@staging-db.internal:5432/dnd_ai?sslmode=require",
        WORKER_REDIS_URL:
          "rediss://worker:redis_password@staging-cache.internal:6380/1",
        WORKER_SENTRY_DSN: workerSecretDsn,
      },
      initialize: async () => {
        initializerCalled = true;
      },
    }),
    (error) => {
      assert.deepEqual(error.invalidKeys, ["WORKER_SENTRY_DSN"]);
      assert.doesNotMatch(error.message, new RegExp(workerSecretDsn));
      return true;
    },
  );
  assert.equal(initializerCalled, false);

  const cliResult = spawnSync(process.execPath, [configCliPath, "worker"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: isolatedEnvironment({
      APP_ENV: "staging",
      WORKER_DATABASE_URL:
        "postgresql://worker_user:worker_password@staging-db.internal:5432/dnd_ai?sslmode=require",
      WORKER_REDIS_URL:
        "rediss://worker:redis_password@staging-cache.internal:6380/1",
      WORKER_SENTRY_DSN: workerSecretDsn,
    }),
  });

  assert.equal(cliResult.status, 1);
  assert.match(cliResult.stderr, /WORKER_SENTRY_DSN/);
  assert.doesNotMatch(cliResult.stderr, new RegExp(workerSecretDsn));
  assert.equal(cliResult.stdout, "");
});

test("configuration CLI smoke passes local and staging fixtures without printing connection strings", () => {
  const cases = [
    ["api", apiEnvironment(3001), "local"],
    [
      "worker",
      {
        APP_ENV: "staging",
        WORKER_DATABASE_URL:
          "postgresql://worker_user:worker_password@staging-db.internal:5432/dnd_ai?sslmode=require",
        WORKER_REDIS_URL:
          "rediss://worker:redis_password@staging-cache.internal:6380/1",
      },
      "staging",
    ],
    [
      "migration",
      {
        APP_ENV: "staging",
        MIGRATION_DATABASE_URL:
          "postgresql://migration_user:migration_password@staging-db.internal:5432/dnd_ai?sslmode=require",
      },
      "staging",
    ],
  ];

  for (const [service, environment, profile] of cases) {
    const result = spawnSync(process.execPath, [configCliPath, service], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: isolatedEnvironment(environment),
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`${service}.*${profile}`));
    assert.doesNotMatch(result.stdout, /postgres|redis|password/i);
    assert.equal(result.stderr, "");
  }
});

test("missing configuration fails both the CLI and API process with safe non-zero exits", () => {
  const secret = "must-never-appear-in-startup-errors";
  const workerResult = spawnSync(process.execPath, [configCliPath, "worker"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: isolatedEnvironment({
      APP_ENV: "staging",
      WORKER_DATABASE_URL: secret,
    }),
  });

  assert.equal(workerResult.status, 1);
  assert.match(workerResult.stderr, /WORKER_DATABASE_URL|WORKER_REDIS_URL/);
  assert.doesNotMatch(workerResult.stderr, new RegExp(secret));

  const apiResult = spawnSync(process.execPath, [apiStartPath], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: isolatedEnvironment(),
    timeout: 5_000,
  });

  assert.equal(apiResult.status, 1);
  assert.match(apiResult.stderr, /APP_ENV|API_HOST|API_PORT/);
  assert.doesNotMatch(apiResult.stderr, /undefined|null/);
});
