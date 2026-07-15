import process from "node:process";

import {
  RuntimeConfigurationError,
  parseMigrationRuntimeConfig,
} from "../packages/config/dist/index.js";
import {
  FeatureFlagError,
  createPostgresFeatureFlagStore,
  isFeatureFlagKey,
} from "../packages/persistence/dist/index.js";

class FeatureFlagCliError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.name = "FeatureFlagCliError";
    this.exitCode = exitCode;
  }
}

function usage() {
  return "Usage: feature-flags <status|set> <catalog-key> [--enable|--disable]";
}

function parseExpectedVersion(value) {
  const version = Number.parseInt(value ?? "", 10);

  if (
    !Number.isSafeInteger(version) ||
    version < 0 ||
    String(version) !== value
  ) {
    throw new FeatureFlagCliError("Invalid feature flag command.");
  }

  return version;
}

function takeOptionValue(argv, index) {
  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw new FeatureFlagCliError("Invalid feature flag command.");
  }

  return value;
}

function parseSetOptions(argv) {
  const options = {
    actorId: null,
    correlationId: null,
    enabled: null,
    expectedVersion: undefined,
    idempotencyKey: null,
    reasonCode: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    switch (token) {
      case "--enable":
      case "--disable":
        if (options.enabled !== null) {
          throw new FeatureFlagCliError("Invalid feature flag command.");
        }
        options.enabled = token === "--enable";
        break;
      case "--actor":
        options.actorId = takeOptionValue(argv, index);
        index += 1;
        break;
      case "--reason":
        options.reasonCode = takeOptionValue(argv, index);
        index += 1;
        break;
      case "--idempotency-key":
        options.idempotencyKey = takeOptionValue(argv, index);
        index += 1;
        break;
      case "--correlation-id":
        options.correlationId = takeOptionValue(argv, index);
        index += 1;
        break;
      case "--expected-version":
        options.expectedVersion = parseExpectedVersion(
          takeOptionValue(argv, index),
        );
        index += 1;
        break;
      default:
        throw new FeatureFlagCliError("Invalid feature flag command.");
    }
  }

  if (
    options.enabled === null ||
    !options.actorId ||
    !options.reasonCode ||
    !options.idempotencyKey
  ) {
    throw new FeatureFlagCliError("Invalid feature flag command.");
  }

  return {
    ...options,
    correlationId: options.correlationId ?? options.idempotencyKey,
  };
}

function parseArguments(argv) {
  const [command, key, ...rest] = argv;

  if ((command !== "status" && command !== "set") || !key) {
    throw new FeatureFlagCliError(usage());
  }

  if (!isFeatureFlagKey(key)) {
    throw new FeatureFlagCliError("Unknown feature flag key.");
  }

  if (command === "status") {
    if (rest.length !== 0) {
      throw new FeatureFlagCliError("Invalid feature flag command.");
    }

    return { command, key };
  }

  return { command, key, options: parseSetOptions(rest) };
}

function safeError(error) {
  if (error instanceof FeatureFlagCliError) {
    return { message: error.message, exitCode: error.exitCode };
  }

  if (error instanceof RuntimeConfigurationError) {
    return { message: error.message, exitCode: 1 };
  }

  if (error instanceof FeatureFlagError) {
    return {
      message: `Feature flag operation failed (${error.code})`,
      exitCode: error.code === "STORE_UNAVAILABLE" ? 1 : 2,
    };
  }

  return { message: "Feature flag operation failed.", exitCode: 1 };
}

let store;

try {
  const request = parseArguments(process.argv.slice(2));
  const configuration = parseMigrationRuntimeConfig(process.env);
  store = createPostgresFeatureFlagStore({
    databaseUrl: configuration.databaseUrl,
  });

  if (request.command === "status") {
    const state = await store.readFeatureFlag(request.key);
    process.stdout.write(
      `Feature flag status: key=${state.key}; enabled=${state.enabled}; version=${state.version}\n`,
    );
  } else {
    const result = await store.changeFeatureFlag({
      key: request.key,
      enabled: request.options.enabled,
      actorId: request.options.actorId,
      reasonCode: request.options.reasonCode,
      idempotencyKey: request.options.idempotencyKey,
      correlationId: request.options.correlationId,
      ...(request.options.expectedVersion === undefined
        ? {}
        : { expectedVersion: request.options.expectedVersion }),
    });
    process.stdout.write(
      `Feature flag set: key=${result.state.key}; enabled=${result.state.enabled}; version=${result.state.version}; auditEventId=${result.auditEventId}; replay=${result.idempotentReplay}\n`,
    );
  }
} catch (error) {
  const { message, exitCode } = safeError(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = exitCode;
} finally {
  await store?.close().catch(() => undefined);
}
