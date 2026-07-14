import { createHash } from "node:crypto";

export const DATABASE_CONTRACT_VERSION = "database-baseline-v1";
export const DATABASE_MIGRATION_HEAD = "000001_postgresql_foundation";
export const DATABASE_BASELINE_MIGRATION_SOURCE_SHA256 =
  "e8543d84b9b842adf352260536dcea284c93dfb859c9ec03368f10deb9455fc7";

// Derived from the first 32 bits of SHA-256("dnd-ai:database-migrations")
// and kept in the signed 32-bit range for PostgreSQL advisory locking.
export const DATABASE_MIGRATION_LOCK_VALUE = 1_393_833_236;

export const DATABASE_BASELINE_TABLE_SQL = `
CREATE TABLE infra.migration_contracts (
  migration_id integer NOT NULL,
  migration_name text NOT NULL,
  contract_version text NOT NULL,
  checksum text NOT NULL,
  minimum_compatible_migration_id integer NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  superseded_at timestamptz NULL,
  CONSTRAINT migration_contracts_pkey PRIMARY KEY (migration_id),
  CONSTRAINT migration_contracts_migration_name_key UNIQUE (migration_name),
  CONSTRAINT migration_contracts_migration_id_positive CHECK (migration_id > 0),
  CONSTRAINT migration_contracts_migration_name_not_blank CHECK (char_length(btrim(migration_name)) > 0),
  CONSTRAINT migration_contracts_contract_version_not_blank CHECK (char_length(btrim(contract_version)) > 0),
  CONSTRAINT migration_contracts_checksum_sha256 CHECK (checksum ~ '^[0-9a-f]{64}$'),
  CONSTRAINT migration_contracts_compatibility_range CHECK (
    minimum_compatible_migration_id > 0
    AND minimum_compatible_migration_id <= migration_id
  ),
  CONSTRAINT migration_contracts_superseded_after_applied CHECK (
    superseded_at IS NULL OR superseded_at >= applied_at
  )
);
`.trim();

export const DATABASE_BASELINE_ACTIVE_INDEX_SQL = `
CREATE UNIQUE INDEX migration_contracts_one_active_idx
ON infra.migration_contracts ((true))
WHERE superseded_at IS NULL;
`.trim();

const baselineContractDefinition = Object.freeze({
  migrationId: 1,
  migrationName: DATABASE_MIGRATION_HEAD,
  contractVersion: DATABASE_CONTRACT_VERSION,
  fileName: DATABASE_MIGRATION_HEAD,
  minimumCompatibleMigrationId: 1,
});

const baselineCanonicalDefinition = [
  DATABASE_BASELINE_MIGRATION_SOURCE_SHA256,
  "CREATE EXTENSION vector;",
  "CREATE SCHEMA app;",
  DATABASE_BASELINE_TABLE_SQL,
  DATABASE_BASELINE_ACTIVE_INDEX_SQL,
  JSON.stringify(baselineContractDefinition),
].join("\n");

const baselineChecksum = createHash("sha256")
  .update(baselineCanonicalDefinition, "utf8")
  .digest("hex");

export interface DatabaseMigrationManifestEntry {
  readonly migrationId: number;
  readonly migrationName: string;
  readonly contractVersion: string;
  readonly fileName: string;
  readonly checksum: string;
  readonly minimumCompatibleMigrationId: number;
}

const baselineContract = Object.freeze({
  ...baselineContractDefinition,
  checksum: baselineChecksum,
});

export const DATABASE_MIGRATION_MANIFEST = Object.freeze([
  baselineContract,
]) satisfies readonly DatabaseMigrationManifestEntry[];

function quoteSqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export const DATABASE_BASELINE_CONTRACT_INSERT_SQL = `
INSERT INTO infra.migration_contracts (
  migration_id,
  migration_name,
  contract_version,
  checksum,
  minimum_compatible_migration_id
)
VALUES (
  ${baselineContract.migrationId},
  ${quoteSqlLiteral(baselineContract.migrationName)},
  ${quoteSqlLiteral(baselineContract.contractVersion)},
  ${quoteSqlLiteral(baselineContract.checksum)},
  ${baselineContract.minimumCompatibleMigrationId}
);
`.trim();
