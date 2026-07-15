import { createHash } from "node:crypto";

import { FEATURE_FLAG_CATALOG } from "./feature-flags.js";

export const DATABASE_BASELINE_CONTRACT_VERSION = "database-baseline-v1";
export const DATABASE_BASELINE_MIGRATION_NAME = "000001_postgresql_foundation";
export const DATABASE_FEATURE_FLAGS_CONTRACT_VERSION =
  "database-feature-flags-v1";
export const DATABASE_FEATURE_FLAGS_MIGRATION_NAME = "000002_feature_flags";
export const DATABASE_CONTRACT_VERSION =
  DATABASE_FEATURE_FLAGS_CONTRACT_VERSION;
export const DATABASE_MIGRATION_HEAD = DATABASE_FEATURE_FLAGS_MIGRATION_NAME;
export const DATABASE_BASELINE_MIGRATION_SOURCE_SHA256 =
  "e8543d84b9b842adf352260536dcea284c93dfb859c9ec03368f10deb9455fc7";
export const FEATURE_FLAGS_MIGRATION_SOURCE_SHA256 =
  "6fa16b6639d20772f0260f1f39201b91c42162b73f9d716f2677fe1328ed5ec8";

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
  migrationName: DATABASE_BASELINE_MIGRATION_NAME,
  contractVersion: DATABASE_BASELINE_CONTRACT_VERSION,
  fileName: DATABASE_BASELINE_MIGRATION_NAME,
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

export const DATABASE_FEATURE_FLAGS_TABLE_SQL = `
CREATE TABLE app.feature_flags (
  flag_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  default_enabled boolean NOT NULL DEFAULT false,
  version bigint NOT NULL DEFAULT 0,
  owner text NOT NULL,
  updated_by text NOT NULL DEFAULT 'system:migration',
  updated_reason_code text NOT NULL DEFAULT 'operator_request',
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT feature_flags_pkey PRIMARY KEY (flag_key),
  CONSTRAINT feature_flags_key_format CHECK (flag_key ~ '^[a-z][a-z0-9]*(\\.[a-z][a-z0-9-]*)+$'),
  CONSTRAINT feature_flags_owner_format CHECK (owner ~ '^[a-z][a-z0-9-]{1,40}$'),
  CONSTRAINT feature_flags_default_disabled CHECK (default_enabled = false),
  CONSTRAINT feature_flags_version_non_negative CHECK (version >= 0),
  CONSTRAINT feature_flags_updated_by_format CHECK (updated_by ~ '^[A-Za-z0-9][A-Za-z0-9_:@./-]{2,127}$'),
  CONSTRAINT feature_flags_reason_code_format CHECK (updated_reason_code ~ '^[a-z][a-z0-9_]{2,63}$')
);
`.trim();

export const DATABASE_FEATURE_FLAG_EVENTS_TABLE_SQL = `
CREATE TABLE app.feature_flag_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY,
  flag_key text NOT NULL,
  idempotency_key text NOT NULL,
  command_hash text NOT NULL,
  previous_version bigint NOT NULL,
  resulting_version bigint NOT NULL,
  enabled boolean NOT NULL,
  actor_id text NOT NULL,
  reason_code text NOT NULL,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT feature_flag_events_pkey PRIMARY KEY (event_id),
  CONSTRAINT feature_flag_events_flag_fkey FOREIGN KEY (flag_key)
    REFERENCES app.feature_flags (flag_key) ON DELETE RESTRICT,
  CONSTRAINT feature_flag_events_idempotency_key_key UNIQUE (idempotency_key),
  CONSTRAINT feature_flag_events_idempotency_key_format CHECK (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$'),
  CONSTRAINT feature_flag_events_command_hash_sha256 CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT feature_flag_events_previous_version_non_negative CHECK (previous_version >= 0),
  CONSTRAINT feature_flag_events_resulting_version_increments CHECK (resulting_version = previous_version + 1),
  CONSTRAINT feature_flag_events_actor_id_format CHECK (actor_id ~ '^[A-Za-z0-9][A-Za-z0-9_:@./-]{2,127}$'),
  CONSTRAINT feature_flag_events_reason_code_format CHECK (reason_code ~ '^[a-z][a-z0-9_]{2,63}$'),
  CONSTRAINT feature_flag_events_correlation_id_format CHECK (correlation_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$')
);
`.trim();

export const DATABASE_FEATURE_FLAG_EVENTS_LOOKUP_INDEX_SQL = `
CREATE INDEX feature_flag_events_flag_key_created_at_idx
ON app.feature_flag_events (flag_key, created_at, event_id);
`.trim();

function featureFlagSeedSql(): string {
  const rows = FEATURE_FLAG_CATALOG.map(
    ({ key, owner }) =>
      `(${quoteSqlLiteral(key)}, false, false, 0, ${quoteSqlLiteral(owner)})`,
  ).join(",\n  ");

  return `
INSERT INTO app.feature_flags (
  flag_key,
  enabled,
  default_enabled,
  version,
  owner
)
VALUES
  ${rows};
`.trim();
}

export const DATABASE_FEATURE_FLAGS_SEED_SQL = featureFlagSeedSql();

const featureFlagsContractDefinition = Object.freeze({
  migrationId: 2,
  migrationName: DATABASE_FEATURE_FLAGS_MIGRATION_NAME,
  contractVersion: DATABASE_FEATURE_FLAGS_CONTRACT_VERSION,
  fileName: DATABASE_FEATURE_FLAGS_MIGRATION_NAME,
  minimumCompatibleMigrationId: 1,
});

const featureFlagsCanonicalDefinition = [
  FEATURE_FLAGS_MIGRATION_SOURCE_SHA256,
  DATABASE_FEATURE_FLAGS_TABLE_SQL,
  DATABASE_FEATURE_FLAG_EVENTS_TABLE_SQL,
  DATABASE_FEATURE_FLAG_EVENTS_LOOKUP_INDEX_SQL,
  DATABASE_FEATURE_FLAGS_SEED_SQL,
  JSON.stringify(featureFlagsContractDefinition),
].join("\n");

const featureFlagsChecksum = createHash("sha256")
  .update(featureFlagsCanonicalDefinition, "utf8")
  .digest("hex");

const featureFlagsContract = Object.freeze({
  ...featureFlagsContractDefinition,
  checksum: featureFlagsChecksum,
});

export const DATABASE_FEATURE_FLAGS_SUPERSEDE_BASELINE_CONTRACT_SQL = `
UPDATE infra.migration_contracts
SET superseded_at = CURRENT_TIMESTAMP
WHERE migration_id = ${baselineContract.migrationId}
  AND superseded_at IS NULL;
`.trim();

export const DATABASE_FEATURE_FLAGS_RESTORE_BASELINE_CONTRACT_SQL = `
UPDATE infra.migration_contracts
SET superseded_at = NULL
WHERE migration_id = ${baselineContract.migrationId};
`.trim();

export const DATABASE_FEATURE_FLAGS_CONTRACT_INSERT_SQL = `
INSERT INTO infra.migration_contracts (
  migration_id,
  migration_name,
  contract_version,
  checksum,
  minimum_compatible_migration_id
)
VALUES (
  ${featureFlagsContract.migrationId},
  ${quoteSqlLiteral(featureFlagsContract.migrationName)},
  ${quoteSqlLiteral(featureFlagsContract.contractVersion)},
  ${quoteSqlLiteral(featureFlagsContract.checksum)},
  ${featureFlagsContract.minimumCompatibleMigrationId}
);
`.trim();

export const DATABASE_MIGRATION_MANIFEST = Object.freeze([
  baselineContract,
  featureFlagsContract,
]) satisfies readonly DatabaseMigrationManifestEntry[];
