import assert from "node:assert/strict";
import test from "node:test";

import {
  RuntimeConfigurationError,
  parseApiRuntimeConfig,
  parseMigrationRuntimeConfig,
  parseWorkerRuntimeConfig,
} from "../../packages/config/dist/index.js";

const apiLocalEnvironment = Object.freeze({
  APP_ENV: "local",
  API_HOST: "127.0.0.1",
  API_PORT: "3001",
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
});

const workerStagingEnvironment = Object.freeze({
  APP_ENV: "staging",
  WORKER_DATABASE_URL:
    "postgresql://worker_user:worker_password@staging-db.internal:5432/dnd_ai?sslmode=require",
  WORKER_REDIS_URL:
    "rediss://worker:redis_password@staging-cache.internal:6380/1",
  WORKER_AUTH_CHALLENGE_HMAC_KEY_BASE64:
    "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
  WORKER_AUTH_CHALLENGE_KEY_VERSION: "7",
  WORKER_AUTH_RESET_HMAC_KEY_BASE64:
    "oKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr8=",
  WORKER_AUTH_RESET_KEY_VERSION: "11",
  WORKER_EMAIL_DELIVERY_MODE: "smtp",
  WORKER_SMTP_HOST: "smtp.internal",
  WORKER_SMTP_PORT: "465",
  WORKER_SMTP_SECURE: "true",
  WORKER_SMTP_USERNAME: "mailer",
  WORKER_SMTP_PASSWORD: "smtp-password",
  WORKER_SMTP_FROM: "AI Adventure <noreply@example.test>",
});

const apiSentryDsn = "https://api-public-key@errors.example.test/101";
const workerSentryDsn = "https://worker-public-key@errors.example.test/202";

function legacyApiConfig(config) {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(config).filter(
        ([key]) => key !== "identity" && key !== "publicOrigin",
      ),
    ),
  );
}

function legacyWorkerConfig(config) {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(config).filter(
        ([key]) => key !== "emailDelivery" && key !== "identity",
      ),
    ),
  );
}

test("optional Sentry DSNs are omitted when absent or blank", () => {
  for (const API_SENTRY_DSN of [undefined, "", "   "]) {
    const config = parseApiRuntimeConfig({
      ...apiLocalEnvironment,
      ...(API_SENTRY_DSN === undefined ? {} : { API_SENTRY_DSN }),
    });

    assert.equal("sentryDsn" in config, false);
    assert.equal(Object.isFrozen(config), true);
  }

  for (const WORKER_SENTRY_DSN of [undefined, "", "   "]) {
    const config = parseWorkerRuntimeConfig({
      ...workerStagingEnvironment,
      ...(WORKER_SENTRY_DSN === undefined ? {} : { WORKER_SENTRY_DSN }),
    });

    assert.equal("sentryDsn" in config, false);
    assert.equal(Object.isFrozen(config), true);
  }
});

test("valid Sentry DSNs remain scoped to their owning service", () => {
  assert.deepEqual(
    legacyApiConfig(
      parseApiRuntimeConfig({
        ...apiLocalEnvironment,
        API_SENTRY_DSN: apiSentryDsn,
        WORKER_SENTRY_DSN: workerSentryDsn,
      }),
    ),
    {
      environment: "local",
      host: "127.0.0.1",
      port: 3001,
      databaseUrl: "postgresql://dnd_api_local@127.0.0.1:5432/dnd_ai_local",
      redisUrl: "redis://127.0.0.1:6379/0",
      sentryDsn: apiSentryDsn,
    },
  );

  assert.deepEqual(
    legacyWorkerConfig(
      parseWorkerRuntimeConfig({
        ...workerStagingEnvironment,
        API_SENTRY_DSN: apiSentryDsn,
        WORKER_SENTRY_DSN: workerSentryDsn,
      }),
    ),
    {
      environment: "staging",
      databaseUrl:
        "postgresql://worker_user:worker_password@staging-db.internal:5432/dnd_ai?sslmode=require",
      redisUrl: "rediss://worker:redis_password@staging-cache.internal:6380/1",
      sentryDsn: workerSentryDsn,
    },
  );
});

test("Sentry DSNs reject unsafe schemes, hosts and project paths without reflection", () => {
  const invalidDsns = [
    "http://public-key@errors.example.test/101",
    "https://public-key@bad_host/101",
    "https://public-key@errors.example.test/",
  ];

  for (const invalidDsn of invalidDsns) {
    assert.throws(
      () =>
        parseApiRuntimeConfig({
          ...apiLocalEnvironment,
          API_SENTRY_DSN: invalidDsn,
        }),
      (error) => {
        assert.equal(error instanceof RuntimeConfigurationError, true);
        assert.deepEqual(error.invalidKeys, ["API_SENTRY_DSN"]);
        assert.doesNotMatch(error.message, new RegExp(invalidDsn));
        assert.equal("cause" in error, false);
        return true;
      },
    );
  }
});

test("API configuration parses, normalizes and strips unrelated environment values", () => {
  const config = legacyApiConfig(
    parseApiRuntimeConfig({
      ...apiLocalEnvironment,
      UNRELATED_PROCESS_VALUE: "must-not-cross-the-boundary",
    }),
  );

  assert.deepEqual(config, {
    environment: "local",
    host: "127.0.0.1",
    port: 3001,
    databaseUrl: "postgresql://dnd_api_local@127.0.0.1:5432/dnd_ai_local",
    redisUrl: "redis://127.0.0.1:6379/0",
  });
  assert.equal(Object.isFrozen(config), true);
  assert.equal("UNRELATED_PROCESS_VALUE" in config, false);
});

test("worker and migration configurations preserve distinct staging and production profiles", () => {
  assert.deepEqual(
    legacyWorkerConfig(parseWorkerRuntimeConfig(workerStagingEnvironment)),
    {
      environment: "staging",
      databaseUrl:
        "postgresql://worker_user:worker_password@staging-db.internal:5432/dnd_ai?sslmode=require",
      redisUrl: "rediss://worker:redis_password@staging-cache.internal:6380/1",
    },
  );

  assert.deepEqual(
    parseMigrationRuntimeConfig({
      APP_ENV: "production",
      MIGRATION_DATABASE_URL:
        "postgres://migration_user:migration_password@production-db.internal:5432/dnd_ai?sslmode=verify-full",
    }),
    {
      environment: "production",
      databaseUrl:
        "postgres://migration_user:migration_password@production-db.internal:5432/dnd_ai?sslmode=verify-full",
    },
  );
});

test("missing staging keys fail without falling back to local or production values", () => {
  assert.throws(
    () =>
      parseWorkerRuntimeConfig({
        ...workerStagingEnvironment,
        WORKER_DATABASE_URL:
          "postgresql://worker_user@staging-db.internal:5432/dnd_ai?sslmode=require",
        WORKER_REDIS_URL: undefined,
      }),
    (error) => {
      assert.equal(error instanceof RuntimeConfigurationError, true);
      assert.equal(error.service, "worker");
      assert.deepEqual(error.invalidKeys, ["WORKER_REDIS_URL"]);
      return true;
    },
  );

  assert.throws(
    () =>
      parseMigrationRuntimeConfig({
        APP_ENV: "production",
        MIGRATION_DATABASE_URL:
          "postgresql://migration:migration_password@production-db.internal:5432/dnd_ai?sslmode=require&sslmode=disable",
      }),
    (error) => {
      assert.deepEqual(error.invalidKeys, ["MIGRATION_DATABASE_URL"]);
      return true;
    },
  );
});

test("missing and malformed values report key names without reflecting secret values", () => {
  const databaseSecret = "database-password-that-must-not-be-reflected";
  const redisSecret = "redis-password-that-must-not-be-reflected";

  assert.throws(
    () =>
      parseApiRuntimeConfig({
        ...apiLocalEnvironment,
        APP_ENV: "preview",
        API_HOST: "",
        API_PORT: "three-thousand",
        API_DATABASE_URL: databaseSecret,
        API_REDIS_URL: redisSecret,
      }),
    (error) => {
      assert.equal(error instanceof RuntimeConfigurationError, true);
      assert.equal(error.service, "api");
      assert.deepEqual(error.invalidKeys, [
        "API_DATABASE_URL",
        "API_HOST",
        "API_PORT",
        "API_REDIS_URL",
        "APP_ENV",
      ]);
      assert.match(error.message, /Invalid runtime configuration for api/);
      assert.doesNotMatch(error.message, new RegExp(databaseSecret));
      assert.doesNotMatch(error.message, new RegExp(redisSecret));
      assert.equal("cause" in error, false);
      return true;
    },
  );
});

test("API ports reject zero, overflow, fractions, suffixes and empty strings", () => {
  for (const invalidPort of ["0", "65536", "3.14", "3000x", ""]) {
    assert.throws(
      () =>
        parseApiRuntimeConfig({
          ...apiLocalEnvironment,
          API_PORT: invalidPort,
        }),
      (error) => {
        assert.deepEqual(error.invalidKeys, ["API_PORT"]);
        return true;
      },
    );
  }
});

test("database and Redis URLs fail closed on unexpected protocols", () => {
  assert.throws(
    () =>
      parseApiRuntimeConfig({
        ...apiLocalEnvironment,
        API_DATABASE_URL: "https://database.example.test/dnd_ai",
        API_REDIS_URL: "https://cache.example.test/0",
      }),
    (error) => {
      assert.deepEqual(error.invalidKeys, [
        "API_DATABASE_URL",
        "API_REDIS_URL",
      ]);
      return true;
    },
  );
});

test("managed profiles require structured hosts, database names, TLS and credentials", () => {
  assert.throws(
    () =>
      parseApiRuntimeConfig({
        ...apiLocalEnvironment,
        APP_ENV: "staging",
        API_PUBLIC_ORIGIN: "https://api.example.test",
        API_HOST: "bad host",
        API_PORT: "3001",
        API_DATABASE_URL: "postgresql:not-a-connection-string",
        API_REDIS_URL: "redis:also-not-a-connection-string",
      }),
    (error) => {
      assert.deepEqual(error.invalidKeys, [
        "API_DATABASE_URL",
        "API_HOST",
        "API_REDIS_URL",
      ]);
      return true;
    },
  );

  assert.throws(() =>
    parseApiRuntimeConfig({
      ...apiLocalEnvironment,
      API_HOST: `${"a".repeat(64)}.example.test`,
    }),
  );

  assert.throws(
    () =>
      parseWorkerRuntimeConfig({
        ...workerStagingEnvironment,
        APP_ENV: "production",
        WORKER_DATABASE_URL:
          "postgresql://worker:database_password@production-db.internal:5432/dnd_ai",
        WORKER_REDIS_URL:
          "redis://worker:redis_password@production-cache.internal:6379/1",
      }),
    (error) => {
      assert.deepEqual(error.invalidKeys, [
        "WORKER_DATABASE_URL",
        "WORKER_REDIS_URL",
      ]);
      return true;
    },
  );

  assert.throws(
    () =>
      parseWorkerRuntimeConfig({
        ...workerStagingEnvironment,
        APP_ENV: "staging",
        WORKER_DATABASE_URL:
          "postgresql://worker@staging-db.internal:5432/dnd_ai?sslmode=require",
        WORKER_REDIS_URL: "rediss://staging-cache.internal:6380/1",
      }),
    (error) => {
      assert.deepEqual(error.invalidKeys, [
        "WORKER_DATABASE_URL",
        "WORKER_REDIS_URL",
      ]);
      return true;
    },
  );

  assert.throws(
    () =>
      parseWorkerRuntimeConfig({
        ...workerStagingEnvironment,
        APP_ENV: "staging",
        WORKER_DATABASE_URL:
          "postgresql://worker:database_password@bad_host:5432/dnd_ai?sslmode=require",
        WORKER_REDIS_URL: "rediss://worker:redis_password@bad_host:6380/1",
      }),
    (error) => {
      assert.deepEqual(error.invalidKeys, [
        "WORKER_DATABASE_URL",
        "WORKER_REDIS_URL",
      ]);
      return true;
    },
  );
});
