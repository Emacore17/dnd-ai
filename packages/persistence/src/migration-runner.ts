import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { runner } from "node-pg-migrate";
import { Client, type ClientConfig } from "pg";

import {
  DATABASE_MIGRATION_HEAD,
  DATABASE_MIGRATION_LOCK_VALUE,
  DATABASE_MIGRATION_MANIFEST,
  type DatabaseMigrationManifestEntry,
} from "./migration-manifest.js";

const MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL("./migrations/", import.meta.url),
);
const MIGRATIONS_SCHEMA = "infra";
const MIGRATIONS_TABLE = "schema_migrations";
// TypeScript emits declarations and source maps beside the executable files.
// node-pg-migrate scans every non-hidden file unless they are rejected here.
const NON_JAVASCRIPT_MIGRATION_PATTERN = "(?!.*\\.js$).*";

const CONNECTION_TIMEOUT_MS = 10_000;
const LOCK_TIMEOUT_MS = 5_000;
const STATEMENT_TIMEOUT_MS = 60_000;
const QUERY_TIMEOUT_MS = 65_000;
const IDLE_TRANSACTION_TIMEOUT_MS = 60_000;

const SILENT_MIGRATION_LOGGER = Object.freeze({
  debug: (): void => undefined,
  info: (): void => undefined,
  warn: (): void => undefined,
  error: (): void => undefined,
});

export type DatabaseMigrationDirection = "up" | "down";
export type DatabaseMigrationErrorCode =
  "INVALID_REQUEST" | "STATE_DRIFT" | "EXECUTION_FAILED";

export interface RunDatabaseMigrationsOptions {
  readonly databaseUrl: string;
  readonly direction: DatabaseMigrationDirection;
  readonly count?: number;
  readonly allowDestructiveRollback?: boolean;
}

export interface GetDatabaseMigrationStatusOptions {
  readonly databaseUrl: string;
}

export interface DatabaseMigrationStatus {
  readonly current: string | null;
  readonly contractVersion: string | null;
  readonly applied: readonly string[];
  readonly pending: readonly string[];
}

export interface DatabaseMigrationRunResult {
  readonly direction: DatabaseMigrationDirection;
  readonly applied: readonly string[];
  readonly current: string | null;
}

export class DatabaseMigrationError extends Error {
  readonly code: DatabaseMigrationErrorCode;

  constructor(
    code: DatabaseMigrationErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "DatabaseMigrationError";
    this.code = code;
  }
}

interface DatabaseObjectPresenceRow {
  readonly ledger_exists: boolean;
  readonly contracts_exists: boolean;
  readonly app_schema_exists: boolean;
  readonly vector_exists: boolean;
}

interface MigrationLedgerRow {
  readonly name: string;
}

interface MigrationContractRow {
  readonly migration_id: number;
  readonly migration_name: string;
  readonly contract_version: string;
  readonly checksum: string;
  readonly minimum_compatible_migration_id: number;
  readonly superseded_at: Date | null;
}

class DatabaseMigrationStateError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "DatabaseMigrationStateError";
  }
}

function invalidRequest(cause: unknown): DatabaseMigrationError {
  return new DatabaseMigrationError(
    "INVALID_REQUEST",
    "Database migration request is invalid.",
    cause,
  );
}

function stateDrift(detail: string): never {
  throw new DatabaseMigrationError(
    "STATE_DRIFT",
    "Database migration state is inconsistent.",
    new DatabaseMigrationStateError(detail),
  );
}

function executionFailure(cause: unknown): DatabaseMigrationError {
  if (cause instanceof DatabaseMigrationError) {
    return cause;
  }

  return new DatabaseMigrationError(
    "EXECUTION_FAILED",
    "Database migration operation failed.",
    cause,
  );
}

function isValidDatabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "postgres:" || url.protocol === "postgresql:") &&
      url.hostname.length > 0 &&
      url.username.length > 0 &&
      url.pathname.length > 1
    );
  } catch {
    return false;
  }
}

function validateDatabaseUrl(databaseUrl: string): void {
  if (!isValidDatabaseUrl(databaseUrl)) {
    throw invalidRequest(new TypeError("Invalid PostgreSQL URL"));
  }
}

function validateRunOptions(options: RunDatabaseMigrationsOptions): void {
  validateDatabaseUrl(options.databaseUrl);

  if (options.direction !== "up" && options.direction !== "down") {
    throw invalidRequest(new TypeError("Invalid migration direction"));
  }

  if (
    options.count !== undefined &&
    (!Number.isSafeInteger(options.count) || options.count < 1)
  ) {
    throw invalidRequest(new TypeError("Invalid migration count"));
  }

  if (
    options.direction === "down" &&
    options.allowDestructiveRollback !== true
  ) {
    throw invalidRequest(
      new TypeError("Destructive rollback requires explicit authorization"),
    );
  }
}

function createClient(databaseUrl: string): Client {
  const configuration: ClientConfig = {
    connectionString: databaseUrl,
    application_name: "dnd-ai-database-migrations",
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    lock_timeout: LOCK_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
    idle_in_transaction_session_timeout: IDLE_TRANSACTION_TIMEOUT_MS,
    keepAlive: true,
  };

  return new Client(configuration);
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function validateMigrationDirectory(): Promise<void> {
  let entries;

  try {
    // This module-owned directory is derived from import.meta.url and never from input.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    entries = await readdir(MIGRATIONS_DIRECTORY, { withFileTypes: true });
  } catch (error) {
    throw executionFailure(error);
  }

  if (entries.some((entry) => entry.isSymbolicLink())) {
    stateDrift("migration directory contains a symbolic link");
  }

  const actualMigrationNames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => entry.name.slice(0, -".js".length))
    .sort();
  const expectedMigrationNames = DATABASE_MIGRATION_MANIFEST.map(
    ({ fileName }) => fileName,
  );

  if (!arraysEqual(actualMigrationNames, expectedMigrationNames)) {
    stateDrift("migration directory does not match the versioned manifest");
  }
}

function contractsMatchManifest(
  rows: readonly MigrationContractRow[],
  manifest: readonly DatabaseMigrationManifestEntry[],
): boolean {
  const actual = rows.map((row) => ({
    migrationId: row.migration_id,
    migrationName: row.migration_name,
    contractVersion: row.contract_version,
    checksum: row.checksum,
    minimumCompatibleMigrationId: row.minimum_compatible_migration_id,
  }));
  const expected = manifest.map((entry) => ({
    migrationId: entry.migrationId,
    migrationName: entry.migrationName,
    contractVersion: entry.contractVersion,
    checksum: entry.checksum,
    minimumCompatibleMigrationId: entry.minimumCompatibleMigrationId,
  }));

  return JSON.stringify(actual) === JSON.stringify(expected);
}

function freezeStatus(
  applied: readonly string[],
  pending: readonly string[],
  contractVersion: string | null,
): DatabaseMigrationStatus {
  const frozenApplied = Object.freeze([...applied]);
  const frozenPending = Object.freeze([...pending]);

  return Object.freeze({
    current: frozenApplied.at(-1) ?? null,
    contractVersion,
    applied: frozenApplied,
    pending: frozenPending,
  });
}

async function readValidatedStatus(
  client: Client,
): Promise<DatabaseMigrationStatus> {
  const presenceResult = await client.query<DatabaseObjectPresenceRow>(`
    SELECT
      to_regclass('infra.schema_migrations') IS NOT NULL AS ledger_exists,
      to_regclass('infra.migration_contracts') IS NOT NULL AS contracts_exists,
      to_regnamespace('app') IS NOT NULL AS app_schema_exists,
      EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) AS vector_exists
  `);
  const presence = presenceResult.rows[0];

  if (!presence) {
    stateDrift("database object inspection returned no row");
  }

  const ledgerRows = presence.ledger_exists
    ? (
        await client.query<MigrationLedgerRow>(`
          SELECT name
          FROM infra.schema_migrations
          ORDER BY run_on, id
        `)
      ).rows
    : [];
  const applied = ledgerRows.map(({ name }) => name);
  const knownMigrationNames = DATABASE_MIGRATION_MANIFEST.map(
    ({ fileName }) => fileName,
  );
  const expectedApplied = knownMigrationNames.slice(0, applied.length);

  if (!arraysEqual(applied, expectedApplied)) {
    stateDrift(
      "migration ledger contains unknown, duplicate or unordered rows",
    );
  }

  if (applied.length === 0) {
    if (
      presence.contracts_exists ||
      presence.app_schema_exists ||
      presence.vector_exists
    ) {
      stateDrift("foundation objects exist without an applied migration");
    }

    return freezeStatus([], knownMigrationNames, null);
  }

  if (
    !presence.ledger_exists ||
    !presence.contracts_exists ||
    !presence.app_schema_exists ||
    !presence.vector_exists
  ) {
    stateDrift("applied migration is missing a required foundation object");
  }

  const contractRows = (
    await client.query<MigrationContractRow>(`
      SELECT
        migration_id,
        migration_name,
        contract_version,
        checksum,
        minimum_compatible_migration_id,
        superseded_at
      FROM infra.migration_contracts
      ORDER BY migration_id
    `)
  ).rows;
  const expectedContracts = DATABASE_MIGRATION_MANIFEST.slice(
    0,
    applied.length,
  );

  if (
    contractRows.length !== expectedContracts.length ||
    !contractsMatchManifest(contractRows, expectedContracts)
  ) {
    stateDrift("migration contract manifest is unknown or has drifted");
  }

  const activeContractIndexes = contractRows.flatMap((row, index) =>
    row.superseded_at === null ? [index] : [],
  );
  if (
    activeContractIndexes.length !== 1 ||
    activeContractIndexes[0] !== contractRows.length - 1
  ) {
    stateDrift("migration contract active-head marker is inconsistent");
  }

  return freezeStatus(
    applied,
    knownMigrationNames.slice(applied.length),
    contractRows.at(-1)?.contract_version ?? null,
  );
}

async function withMigrationClient<Result>(
  databaseUrl: string,
  operation: (client: Client) => Promise<Result>,
): Promise<Result> {
  const client = createClient(databaseUrl);

  try {
    await client.connect();
    return await operation(client);
  } catch (error) {
    throw executionFailure(error);
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function getDatabaseMigrationStatus(
  options: GetDatabaseMigrationStatusOptions,
): Promise<DatabaseMigrationStatus> {
  validateDatabaseUrl(options.databaseUrl);
  await validateMigrationDirectory();
  return withMigrationClient(options.databaseUrl, readValidatedStatus);
}

export async function runDatabaseMigrations(
  options: RunDatabaseMigrationsOptions,
): Promise<DatabaseMigrationRunResult> {
  validateRunOptions(options);
  await validateMigrationDirectory();

  return withMigrationClient(options.databaseUrl, async (client) => {
    await readValidatedStatus(client);

    const count =
      options.direction === "down" ? (options.count ?? 1) : options.count;
    // node-pg-migrate 8 fails immediately through pg_try_advisory_lock. The
    // explicit marker prevents a future library upgrade from changing policy.
    const migrationRunnerOptions = {
      dbClient: client,
      dir: MIGRATIONS_DIRECTORY,
      ignorePattern: NON_JAVASCRIPT_MIGRATION_PATTERN,
      direction: options.direction,
      schema: "public",
      migrationsSchema: MIGRATIONS_SCHEMA,
      migrationsTable: MIGRATIONS_TABLE,
      createMigrationsSchema: true,
      checkOrder: true,
      singleTransaction: true,
      noLock: false,
      lockValue: DATABASE_MIGRATION_LOCK_VALUE,
      advisoryLockMode: "fail" as const,
      decamelize: false,
      verbose: false,
      logger: SILENT_MIGRATION_LOGGER,
      ...(count === undefined ? {} : { count }),
    };
    const migrations = await runner(migrationRunnerOptions);
    const status = await readValidatedStatus(client);
    const changedMigrations = Object.freeze(migrations.map(({ name }) => name));

    return Object.freeze({
      direction: options.direction,
      applied: changedMigrations,
      current: status.current,
    });
  });
}

export { DATABASE_MIGRATION_HEAD };
