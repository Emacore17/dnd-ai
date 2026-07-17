import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import { createConfiguredApiApp, startApi } from "../../apps/api/dist/index.js";
import { initializeWorkerRuntime } from "../../apps/worker/dist/index.js";
import { ObservabilityConfigurationError } from "../../packages/observability/dist/node.js";

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
  "API_PUBLIC_ORIGIN",
  "API_AUTH_PASSWORD_PEPPER_BASE64",
  "API_AUTH_PASSWORD_PEPPER_VERSION",
  "API_AUTH_CHALLENGE_HMAC_KEY_BASE64",
  "API_AUTH_CHALLENGE_KEY_VERSION",
  "API_AUTH_SESSION_HMAC_KEY_BASE64",
  "API_AUTH_SESSION_KEY_VERSION",
  "API_AUTH_RESET_HMAC_KEY_BASE64",
  "API_AUTH_RESET_KEY_VERSION",
  "API_AUTH_SUBJECT_HASH_KEY_BASE64",
  "API_AUTH_BFF_ASSERTION_KEY_BASE64",
  "API_SENTRY_DSN",
  "WORKER_DATABASE_URL",
  "WORKER_REDIS_URL",
  "WORKER_AUTH_CHALLENGE_HMAC_KEY_BASE64",
  "WORKER_AUTH_CHALLENGE_KEY_VERSION",
  "WORKER_AUTH_RESET_HMAC_KEY_BASE64",
  "WORKER_AUTH_RESET_KEY_VERSION",
  "WORKER_EMAIL_DELIVERY_MODE",
  "WORKER_SMTP_HOST",
  "WORKER_SMTP_PORT",
  "WORKER_SMTP_SECURE",
  "WORKER_SMTP_USERNAME",
  "WORKER_SMTP_PASSWORD",
  "WORKER_SMTP_FROM",
  "WORKER_SENTRY_DSN",
  "MIGRATION_DATABASE_URL",
  "WEB_API_INTERNAL_ORIGIN",
  "WEB_AUTH_BFF_ASSERTION_KEY_BASE64",
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
    API_PUBLIC_ORIGIN: "http://127.0.0.1:3000",
    API_AUTH_PASSWORD_PEPPER_BASE64:
      "YGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn8=",
    API_AUTH_PASSWORD_PEPPER_VERSION: "3",
    API_AUTH_CHALLENGE_HMAC_KEY_BASE64:
      "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
    API_AUTH_CHALLENGE_KEY_VERSION: "7",
    API_AUTH_SESSION_HMAC_KEY_BASE64:
      "ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8=",
    API_AUTH_SESSION_KEY_VERSION: "9",
    API_AUTH_RESET_HMAC_KEY_BASE64:
      "oKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr8=",
    API_AUTH_RESET_KEY_VERSION: "11",
    API_AUTH_SUBJECT_HASH_KEY_BASE64:
      "QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xdXl8=",
    API_AUTH_BFF_ASSERTION_KEY_BASE64:
      "gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmam5ydnp8=",
  };
}

function workerEnvironment(environment = "staging") {
  const local = environment === "local";
  return {
    APP_ENV: environment,
    WORKER_DATABASE_URL: local
      ? "postgresql://worker@127.0.0.1:5432/dnd_ai"
      : "postgresql://worker_user:worker_password@staging-db.internal:5432/dnd_ai?sslmode=require",
    WORKER_REDIS_URL: local
      ? "redis://127.0.0.1:6379/0"
      : "rediss://worker:redis_password@staging-cache.internal:6380/1",
    WORKER_AUTH_CHALLENGE_HMAC_KEY_BASE64:
      "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
    WORKER_AUTH_CHALLENGE_KEY_VERSION: "7",
    WORKER_AUTH_RESET_HMAC_KEY_BASE64:
      "oKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr8=",
    WORKER_AUTH_RESET_KEY_VERSION: "11",
    WORKER_EMAIL_DELIVERY_MODE: local ? "fake" : "smtp",
    ...(local
      ? {}
      : {
          WORKER_SMTP_HOST: "smtp.internal",
          WORKER_SMTP_PORT: "465",
          WORKER_SMTP_SECURE: "true",
          WORKER_SMTP_USERNAME: "mailer",
          WORKER_SMTP_PASSWORD: "smtp-password",
          WORKER_SMTP_FROM: "AI Adventure <noreply@example.test>",
        }),
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
  assert.equal(
    runtime.app.hasRoute({ method: "POST", url: "/api/auth/sign-up" }),
    true,
  );
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
    environment: workerEnvironment(),
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

test("incompatible observability setup fails before API listen or worker initialization", async () => {
  const error = new ObservabilityConfigurationError(
    "OBSERVABILITY_ALREADY_INITIALIZED",
    "Observability is already initialized with incompatible configuration.",
  );
  let apiClosed = false;
  let apiListenCalled = false;
  let workerInitializerCalled = false;
  const fakeApp = {
    close() {
      apiClosed = true;
      return Promise.resolve();
    },
    listen() {
      apiListenCalled = true;
      return Promise.resolve("must-not-listen");
    },
  };

  await assert.rejects(
    startApi({
      createApp: () => fakeApp,
      createObservability: () => {
        throw error;
      },
      environment: apiEnvironment(3001),
    }),
    (failure) => failure === error,
  );
  assert.equal(apiListenCalled, false);
  assert.equal(apiClosed, true);

  await assert.rejects(
    initializeWorkerRuntime({
      createObservability: () => {
        throw error;
      },
      environment: workerEnvironment("local"),
      initialize: async () => {
        workerInitializerCalled = true;
      },
    }),
    (failure) => failure === error,
  );
  assert.equal(workerInitializerCalled, false);
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
        ...workerEnvironment(),
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
      ...workerEnvironment(),
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
    ["worker", workerEnvironment(), "staging"],
    [
      "web",
      {
        APP_ENV: "staging",
        WEB_API_INTERNAL_ORIGIN: "https://api.internal",
        WEB_AUTH_BFF_ASSERTION_KEY_BASE64:
          "gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmam5ydnp8=",
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
  assert.match(
    workerResult.stderr,
    /WORKER_DATABASE_URL|WORKER_REDIS_URL|WORKER_EMAIL_DELIVERY_MODE/,
  );
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
