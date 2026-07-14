import process from "node:process";

import {
  RuntimeConfigurationError,
  parseMigrationRuntimeConfig,
} from "../packages/config/dist/index.js";
import {
  DatabaseMigrationError,
  getDatabaseMigrationStatus,
  runDatabaseMigrations,
} from "../packages/persistence/dist/index.js";

import {
  DatabaseMigrationPolicyError,
  parseDatabaseMigrationArguments,
  validateDatabaseMigrationRequest,
} from "./lib/database-migration-policy.mjs";

function migrationNames(value) {
  return Array.isArray(value) ? value : [];
}

function printStatus(status) {
  const current = status.current ?? "empty";
  const contractVersion = status.contractVersion ?? "none";
  process.stdout.write(
    `Database migration status: current=${current}; contract=${contractVersion}; applied=${migrationNames(status.applied).length}; pending=${migrationNames(status.pending).length}\n`,
  );
}

function printResult(result) {
  const current = result.current ?? "empty";
  process.stdout.write(
    `Database migration ${result.direction} complete: current=${current}; changed=${migrationNames(result.applied).length}\n`,
  );
}

function safeError(error) {
  if (
    error instanceof RuntimeConfigurationError ||
    error instanceof DatabaseMigrationPolicyError
  ) {
    return error.message;
  }

  if (error instanceof DatabaseMigrationError) {
    return `Database migration failed (${error.code})`;
  }

  return "Database migration failed";
}

try {
  const parsedRequest = parseDatabaseMigrationArguments(process.argv.slice(2));
  const configuration = parseMigrationRuntimeConfig(process.env);
  const request = validateDatabaseMigrationRequest({
    environment: configuration.environment,
    direction: parsedRequest.direction,
    confirmedLocalRollback: parsedRequest.confirmedLocalRollback,
    databaseUrl: configuration.databaseUrl,
  });

  if (request.direction === "status") {
    printStatus(
      await getDatabaseMigrationStatus({
        databaseUrl: configuration.databaseUrl,
      }),
    );
  } else {
    printResult(
      await runDatabaseMigrations({
        databaseUrl: configuration.databaseUrl,
        direction: request.direction,
        count: request.direction === "down" ? 1 : undefined,
        allowDestructiveRollback: request.allowDestructiveRollback,
      }),
    );
  }
} catch (error) {
  process.stderr.write(`${safeError(error)}\n`);
  process.exitCode =
    error instanceof DatabaseMigrationPolicyError ? error.exitCode : 1;
}
