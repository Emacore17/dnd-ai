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
});

const workerStagingEnvironment = Object.freeze({
  APP_ENV: "staging",
  WORKER_DATABASE_URL:
    "postgresql://worker_user:worker_password@staging-db.internal:5432/dnd_ai?sslmode=require",
  WORKER_REDIS_URL:
    "rediss://worker:redis_password@staging-cache.internal:6380/1",
});

test("API configuration parses, normalizes and strips unrelated environment values", () => {
  const config = parseApiRuntimeConfig({
    ...apiLocalEnvironment,
    UNRELATED_PROCESS_VALUE: "must-not-cross-the-boundary",
  });

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
  assert.deepEqual(parseWorkerRuntimeConfig(workerStagingEnvironment), {
    environment: "staging",
    databaseUrl:
      "postgresql://worker_user:worker_password@staging-db.internal:5432/dnd_ai?sslmode=require",
    redisUrl: "rediss://worker:redis_password@staging-cache.internal:6380/1",
  });

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
        APP_ENV: "staging",
        WORKER_DATABASE_URL:
          "postgresql://worker_user@staging-db.internal:5432/dnd_ai?sslmode=require",
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
        APP_ENV: "staging",
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
