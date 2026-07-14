import { URL } from "node:url";

export const LOCAL_ROLLBACK_CONFIRMATION = "--confirm-local-rollback";

const SUPPORTED_DIRECTIONS = Object.freeze(["up", "down", "status"]);
const DISPOSABLE_DATABASE_NAMES = new Set(["dnd_ai_local", "dnd_ai_test"]);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "::1", "localhost"]);

export class DatabaseMigrationPolicyError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.name = "DatabaseMigrationPolicyError";
    this.exitCode = exitCode;
  }
}

function isSupportedDirection(value) {
  return SUPPORTED_DIRECTIONS.includes(value);
}

export function isDisposableLocalDatabaseUrl(value) {
  try {
    const url = new URL(value);
    const databaseName = decodeURIComponent(url.pathname.slice(1));

    return (
      (url.protocol === "postgres:" || url.protocol === "postgresql:") &&
      LOOPBACK_HOSTS.has(url.hostname) &&
      DISPOSABLE_DATABASE_NAMES.has(databaseName) &&
      url.search.length === 0 &&
      url.hash.length === 0
    );
  } catch {
    return false;
  }
}

export function parseDatabaseMigrationArguments(argumentsList) {
  const [direction, ...options] = argumentsList;

  if (!isSupportedDirection(direction)) {
    throw new DatabaseMigrationPolicyError(
      "Usage: database-migrations (up, status, or down --confirm-local-rollback)",
      2,
    );
  }

  if (direction === "down") {
    if (options.length !== 1 || options[0] !== LOCAL_ROLLBACK_CONFIRMATION) {
      throw new DatabaseMigrationPolicyError(
        `Local rollback requires ${LOCAL_ROLLBACK_CONFIRMATION}`,
        2,
      );
    }

    return Object.freeze({
      direction,
      confirmedLocalRollback: true,
    });
  }

  if (options.length > 0) {
    throw new DatabaseMigrationPolicyError(
      `The ${direction} command does not accept options`,
      2,
    );
  }

  return Object.freeze({
    direction,
    confirmedLocalRollback: false,
  });
}

export function validateDatabaseMigrationRequest({
  environment,
  direction,
  confirmedLocalRollback = false,
  databaseUrl,
}) {
  if (!isSupportedDirection(direction)) {
    throw new DatabaseMigrationPolicyError(
      "Unsupported database migration direction",
      2,
    );
  }

  if (direction !== "down") {
    return Object.freeze({ direction, allowDestructiveRollback: false });
  }

  if (environment !== "local") {
    throw new DatabaseMigrationPolicyError(
      "Database rollback is forbidden outside the local environment",
    );
  }

  if (!confirmedLocalRollback) {
    throw new DatabaseMigrationPolicyError(
      `Local rollback requires ${LOCAL_ROLLBACK_CONFIRMATION}`,
    );
  }

  if (!isDisposableLocalDatabaseUrl(databaseUrl)) {
    throw new DatabaseMigrationPolicyError(
      "Database rollback requires a disposable loopback database",
    );
  }

  return Object.freeze({ direction, allowDestructiveRollback: true });
}
