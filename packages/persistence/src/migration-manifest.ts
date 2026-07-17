import { createHash } from "node:crypto";

import { FEATURE_FLAG_CATALOG } from "./feature-flags.js";

export const DATABASE_BASELINE_CONTRACT_VERSION = "database-baseline-v1";
export const DATABASE_BASELINE_MIGRATION_NAME = "000001_postgresql_foundation";
export const DATABASE_FEATURE_FLAGS_CONTRACT_VERSION =
  "database-feature-flags-v1";
export const DATABASE_FEATURE_FLAGS_MIGRATION_NAME = "000002_feature_flags";
export const DATABASE_IDENTITY_SIGNUP_CONTRACT_VERSION =
  "database-identity-signup-v1";
export const DATABASE_IDENTITY_SIGNUP_MIGRATION_NAME = "000003_identity_signup";
export const DATABASE_IDENTITY_ACCESS_CONTRACT_VERSION =
  "database-identity-access-v1";
export const DATABASE_IDENTITY_ACCESS_MIGRATION_NAME = "000004_identity_access";
export const DATABASE_CONTRACT_VERSION =
  DATABASE_IDENTITY_ACCESS_CONTRACT_VERSION;
export const DATABASE_MIGRATION_HEAD = DATABASE_IDENTITY_ACCESS_MIGRATION_NAME;
export const DATABASE_BASELINE_MIGRATION_SOURCE_SHA256 =
  "e8543d84b9b842adf352260536dcea284c93dfb859c9ec03368f10deb9455fc7";
export const FEATURE_FLAGS_MIGRATION_SOURCE_SHA256 =
  "6fa16b6639d20772f0260f1f39201b91c42162b73f9d716f2677fe1328ed5ec8";
export const IDENTITY_SIGNUP_MIGRATION_SOURCE_SHA256 =
  "22821ad6cf592d99ed63cd444cf2a6b4e3ea936685c0e32b975bf71e06969d05";
export const IDENTITY_ACCESS_MIGRATION_SOURCE_SHA256 =
  "330164398efd1ce9bd4463753f1ca01cb5ef3eaa56a187fe10b7097f0c2385d9";

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

export const DATABASE_IDENTITY_USERS_TABLE_SQL = `
CREATE TABLE app.users (
  user_id uuid NOT NULL,
  canonical_email text COLLATE "C" NOT NULL,
  delivery_email text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activated_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_pkey PRIMARY KEY (user_id),
  CONSTRAINT users_canonical_email_key UNIQUE (canonical_email),
  CONSTRAINT users_canonical_email_format CHECK (
    canonical_email = lower(btrim(canonical_email))
    AND char_length(canonical_email) BETWEEN 3 AND 254
    AND canonical_email ~ '^[^[:space:]@]+@[^[:space:]@]+$'
  ),
  CONSTRAINT users_delivery_email_format CHECK (
    delivery_email = btrim(delivery_email)
    AND char_length(delivery_email) BETWEEN 3 AND 254
    AND delivery_email ~ '^[^[:space:]@]+@[^[:space:]@]+$'
  ),
  CONSTRAINT users_display_name_length CHECK (char_length(display_name) BETWEEN 2 AND 40),
  CONSTRAINT users_status_known CHECK (status IN ('pending', 'active')),
  CONSTRAINT users_activation_state_coherent CHECK (
    (status = 'pending' AND activated_at IS NULL)
    OR (status = 'active' AND activated_at IS NOT NULL)
  ),
  CONSTRAINT users_timestamps_coherent CHECK (
    updated_at >= created_at
    AND (activated_at IS NULL OR activated_at >= created_at)
  )
);
`.trim();

export const DATABASE_IDENTITY_USER_CREDENTIALS_TABLE_SQL = `
CREATE TABLE app.user_credentials (
  user_id uuid NOT NULL,
  password_hash text NOT NULL,
  pepper_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_credentials_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_credentials_user_fkey FOREIGN KEY (user_id)
    REFERENCES app.users (user_id) ON DELETE RESTRICT,
  CONSTRAINT user_credentials_password_hash_argon2id CHECK (
    password_hash LIKE '$argon2id$%'
    AND char_length(password_hash) BETWEEN 60 AND 512
  ),
  CONSTRAINT user_credentials_pepper_version_positive CHECK (pepper_version > 0),
  CONSTRAINT user_credentials_timestamps_coherent CHECK (updated_at >= created_at)
);
`.trim();

export const DATABASE_IDENTITY_CHALLENGES_TABLE_SQL = `
CREATE TABLE app.email_verification_challenges (
  challenge_id uuid NOT NULL,
  user_id uuid NOT NULL,
  code_digest text COLLATE "C" NOT NULL,
  key_version integer NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,
  superseded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT email_verification_challenges_pkey PRIMARY KEY (challenge_id),
  CONSTRAINT email_verification_challenges_user_fkey FOREIGN KEY (user_id)
    REFERENCES app.users (user_id) ON DELETE RESTRICT,
  CONSTRAINT email_verification_challenges_code_digest_sha256 CHECK (code_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT email_verification_challenges_key_version_positive CHECK (key_version > 0),
  CONSTRAINT email_verification_challenges_attempts_bounded CHECK (
    max_attempts = 5 AND attempt_count BETWEEN 0 AND max_attempts
  ),
  CONSTRAINT email_verification_challenges_expiry_after_creation CHECK (expires_at > created_at),
  CONSTRAINT email_verification_challenges_terminal_state CHECK (
    NOT (consumed_at IS NOT NULL AND superseded_at IS NOT NULL)
    AND (consumed_at IS NULL OR consumed_at >= created_at)
    AND (superseded_at IS NULL OR superseded_at >= created_at)
  )
);
`.trim();

export const DATABASE_IDENTITY_CHALLENGES_INDEXES_SQL = `
CREATE UNIQUE INDEX email_verification_challenges_one_current_idx
ON app.email_verification_challenges (user_id)
WHERE consumed_at IS NULL AND superseded_at IS NULL;

CREATE INDEX email_verification_challenges_lookup_idx
ON app.email_verification_challenges (user_id, created_at DESC)
INCLUDE (challenge_id, key_version, expires_at, attempt_count, max_attempts);
`.trim();

export const DATABASE_IDENTITY_SESSIONS_TABLE_SQL = `
CREATE TABLE app.user_sessions (
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  token_digest text COLLATE "C" NOT NULL,
  key_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  idle_expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  CONSTRAINT user_sessions_pkey PRIMARY KEY (session_id),
  CONSTRAINT user_sessions_user_fkey FOREIGN KEY (user_id)
    REFERENCES app.users (user_id) ON DELETE RESTRICT,
  CONSTRAINT user_sessions_token_digest_key UNIQUE (token_digest),
  CONSTRAINT user_sessions_token_digest_sha256 CHECK (token_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT user_sessions_key_version_positive CHECK (key_version > 0),
  CONSTRAINT user_sessions_expiry_coherent CHECK (
    last_seen_at >= created_at
    AND idle_expires_at > created_at
    AND absolute_expires_at >= idle_expires_at
    AND (revoked_at IS NULL OR revoked_at >= created_at)
  )
);
`.trim();

export const DATABASE_IDENTITY_SESSIONS_INDEX_SQL = `
CREATE INDEX user_sessions_user_active_idx
ON app.user_sessions (user_id, absolute_expires_at DESC)
WHERE revoked_at IS NULL;
`.trim();

export const DATABASE_IDENTITY_OUTBOX_TABLE_SQL = `
CREATE TABLE app.identity_email_outbox (
  outbox_id uuid NOT NULL,
  user_id uuid NOT NULL,
  challenge_id uuid NOT NULL,
  template_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL,
  lease_until timestamptz NULL,
  lease_token uuid NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at timestamptz NULL,
  CONSTRAINT identity_email_outbox_pkey PRIMARY KEY (outbox_id),
  CONSTRAINT identity_email_outbox_user_fkey FOREIGN KEY (user_id)
    REFERENCES app.users (user_id) ON DELETE RESTRICT,
  CONSTRAINT identity_email_outbox_challenge_fkey FOREIGN KEY (challenge_id)
    REFERENCES app.email_verification_challenges (challenge_id) ON DELETE RESTRICT,
  CONSTRAINT identity_email_outbox_challenge_key UNIQUE (challenge_id),
  CONSTRAINT identity_email_outbox_template_known CHECK (template_key = 'email_verification_v1'),
  CONSTRAINT identity_email_outbox_status_known CHECK (status IN ('pending', 'leased', 'sent', 'dead')),
  CONSTRAINT identity_email_outbox_attempts_bounded CHECK (attempt_count BETWEEN 0 AND 5),
  CONSTRAINT identity_email_outbox_lease_state_coherent CHECK (
    (status = 'leased' AND lease_until IS NOT NULL AND lease_token IS NOT NULL)
    OR (status <> 'leased' AND lease_until IS NULL AND lease_token IS NULL)
  ),
  CONSTRAINT identity_email_outbox_sent_state_coherent CHECK (
    (status = 'sent' AND sent_at IS NOT NULL)
    OR (status <> 'sent' AND sent_at IS NULL)
  ),
  CONSTRAINT identity_email_outbox_timestamps_coherent CHECK (
    updated_at >= created_at
    AND next_attempt_at >= created_at
    AND (lease_until IS NULL OR lease_until > updated_at)
    AND (sent_at IS NULL OR sent_at >= created_at)
  )
);
`.trim();

export const DATABASE_IDENTITY_OUTBOX_INDEX_SQL = `
CREATE INDEX identity_email_outbox_dispatch_idx
ON app.identity_email_outbox (next_attempt_at, created_at)
WHERE status IN ('pending', 'leased');
`.trim();

export const DATABASE_IDENTITY_RATE_LIMITS_TABLE_SQL = `
CREATE TABLE app.identity_rate_limits (
  scope text NOT NULL,
  subject_hash text COLLATE "C" NOT NULL,
  window_started_at timestamptz NOT NULL,
  window_expires_at timestamptz NOT NULL,
  hit_count integer NOT NULL,
  limit_count integer NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT identity_rate_limits_pkey PRIMARY KEY (scope, subject_hash),
  CONSTRAINT identity_rate_limits_scope_known CHECK (
    scope IN ('signup_ip', 'signup_email', 'verify_ip', 'verify_challenge', 'resend_ip', 'resend_email')
  ),
  CONSTRAINT identity_rate_limits_subject_hash_sha256 CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT identity_rate_limits_hits_bounded CHECK (
    limit_count > 0 AND hit_count BETWEEN 1 AND limit_count
  ),
  CONSTRAINT identity_rate_limits_window_coherent CHECK (
    window_expires_at > window_started_at
    AND updated_at >= window_started_at
    AND updated_at <= window_expires_at
  )
);
`.trim();

export const DATABASE_IDENTITY_RATE_LIMITS_INDEX_SQL = `
CREATE INDEX identity_rate_limits_expiry_idx
ON app.identity_rate_limits (window_expires_at);
`.trim();

export const DATABASE_IDENTITY_IDEMPOTENCY_TABLE_SQL = `
CREATE TABLE app.identity_idempotency (
  idempotency_id uuid NOT NULL,
  actor_subject_hash text COLLATE "C" NOT NULL,
  endpoint text NOT NULL,
  key_digest text COLLATE "C" NOT NULL,
  request_fingerprint text COLLATE "C" NOT NULL,
  response_kind text NOT NULL,
  result_reference uuid NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at timestamptz NOT NULL,
  CONSTRAINT identity_idempotency_pkey PRIMARY KEY (idempotency_id),
  CONSTRAINT identity_idempotency_scope_key UNIQUE (endpoint, actor_subject_hash, key_digest),
  CONSTRAINT identity_idempotency_actor_hash_sha256 CHECK (actor_subject_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT identity_idempotency_endpoint_known CHECK (endpoint IN ('sign_up', 'verify_email', 'resend_verification')),
  CONSTRAINT identity_idempotency_key_digest_sha256 CHECK (key_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT identity_idempotency_request_fingerprint_sha256 CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT identity_idempotency_response_known CHECK (
    response_kind IN ('accepted', 'verified', 'already_verified', 'invalid_code', 'expired', 'attempts_exhausted', 'cooldown')
  ),
  CONSTRAINT identity_idempotency_expiry_coherent CHECK (expires_at > created_at)
);
`.trim();

export const DATABASE_IDENTITY_IDEMPOTENCY_INDEX_SQL = `
CREATE INDEX identity_idempotency_expiry_idx
ON app.identity_idempotency (expires_at);
`.trim();

export const DATABASE_IDENTITY_AUDIT_TABLE_SQL = `
CREATE TABLE app.identity_audit_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY,
  event_type text NOT NULL,
  user_id uuid NULL,
  request_id text NULL,
  correlation_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT identity_audit_events_pkey PRIMARY KEY (event_id),
  CONSTRAINT identity_audit_events_user_fkey FOREIGN KEY (user_id)
    REFERENCES app.users (user_id) ON DELETE RESTRICT,
  CONSTRAINT identity_audit_events_type_known CHECK (
    event_type IN (
      'signup_accepted', 'signup_existing', 'verification_failed',
      'email_verified', 'verification_resent', 'resend_ignored'
    )
  ),
  CONSTRAINT identity_audit_events_request_id_format CHECK (
    request_id IS NULL OR request_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$'
  ),
  CONSTRAINT identity_audit_events_correlation_id_format CHECK (
    correlation_id IS NULL OR correlation_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$'
  ),
  CONSTRAINT identity_audit_events_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT identity_audit_events_metadata_size CHECK (octet_length(metadata::text) <= 2048),
  CONSTRAINT identity_audit_events_metadata_allowlist CHECK (
    (metadata - ARRAY['challenge_id', 'session_id', 'reason_code', 'idempotent_replay']::text[]) = '{}'::jsonb
  )
);
`.trim();

export const DATABASE_IDENTITY_AUDIT_INDEX_SQL = `
CREATE INDEX identity_audit_events_user_occurred_idx
ON app.identity_audit_events (user_id, occurred_at DESC, event_id)
WHERE user_id IS NOT NULL;
`.trim();

export const DATABASE_IDENTITY_AUDIT_APPEND_ONLY_SQL = `
CREATE FUNCTION app.reject_identity_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $identity_audit$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'identity audit events are append-only';
END;
$identity_audit$;

CREATE TRIGGER identity_audit_events_append_only
BEFORE UPDATE OR DELETE ON app.identity_audit_events
FOR EACH ROW EXECUTE FUNCTION app.reject_identity_audit_mutation();
`.trim();

const identitySignupContractDefinition = Object.freeze({
  migrationId: 3,
  migrationName: DATABASE_IDENTITY_SIGNUP_MIGRATION_NAME,
  contractVersion: DATABASE_IDENTITY_SIGNUP_CONTRACT_VERSION,
  fileName: DATABASE_IDENTITY_SIGNUP_MIGRATION_NAME,
  minimumCompatibleMigrationId: 1,
});

export const DATABASE_IDENTITY_SUPERSEDE_FEATURE_FLAGS_CONTRACT_SQL = `
UPDATE infra.migration_contracts
SET superseded_at = GREATEST(CURRENT_TIMESTAMP, applied_at)
WHERE migration_id = ${featureFlagsContract.migrationId}
  AND superseded_at IS NULL;
`.trim();

const identitySignupCanonicalDefinition = [
  IDENTITY_SIGNUP_MIGRATION_SOURCE_SHA256,
  DATABASE_IDENTITY_USERS_TABLE_SQL,
  DATABASE_IDENTITY_USER_CREDENTIALS_TABLE_SQL,
  DATABASE_IDENTITY_CHALLENGES_TABLE_SQL,
  DATABASE_IDENTITY_CHALLENGES_INDEXES_SQL,
  DATABASE_IDENTITY_SESSIONS_TABLE_SQL,
  DATABASE_IDENTITY_SESSIONS_INDEX_SQL,
  DATABASE_IDENTITY_OUTBOX_TABLE_SQL,
  DATABASE_IDENTITY_OUTBOX_INDEX_SQL,
  DATABASE_IDENTITY_RATE_LIMITS_TABLE_SQL,
  DATABASE_IDENTITY_RATE_LIMITS_INDEX_SQL,
  DATABASE_IDENTITY_IDEMPOTENCY_TABLE_SQL,
  DATABASE_IDENTITY_IDEMPOTENCY_INDEX_SQL,
  DATABASE_IDENTITY_AUDIT_TABLE_SQL,
  DATABASE_IDENTITY_AUDIT_INDEX_SQL,
  DATABASE_IDENTITY_AUDIT_APPEND_ONLY_SQL,
  DATABASE_IDENTITY_SUPERSEDE_FEATURE_FLAGS_CONTRACT_SQL,
  JSON.stringify(identitySignupContractDefinition),
].join("\n");

const identitySignupChecksum = createHash("sha256")
  .update(identitySignupCanonicalDefinition, "utf8")
  .digest("hex");

const identitySignupContract = Object.freeze({
  ...identitySignupContractDefinition,
  checksum: identitySignupChecksum,
});

export const DATABASE_IDENTITY_RESTORE_FEATURE_FLAGS_CONTRACT_SQL = `
UPDATE infra.migration_contracts
SET superseded_at = NULL
WHERE migration_id = ${featureFlagsContract.migrationId};
`.trim();

export const DATABASE_IDENTITY_CONTRACT_INSERT_SQL = `
INSERT INTO infra.migration_contracts (
  migration_id,
  migration_name,
  contract_version,
  checksum,
  minimum_compatible_migration_id
)
VALUES (
  ${identitySignupContract.migrationId},
  ${quoteSqlLiteral(identitySignupContract.migrationName)},
  ${quoteSqlLiteral(identitySignupContract.contractVersion)},
  ${quoteSqlLiteral(identitySignupContract.checksum)},
  ${identitySignupContract.minimumCompatibleMigrationId}
);
`.trim();

export const DATABASE_IDENTITY_ACCESS_CREDENTIAL_VERSION_SQL = `
ALTER TABLE app.user_credentials
  ADD COLUMN credential_version bigint NOT NULL DEFAULT 1;

ALTER TABLE app.user_credentials
  ADD CONSTRAINT user_credentials_credential_version_positive
  CHECK (credential_version > 0);
`.trim();

export const DATABASE_IDENTITY_ACCESS_RESET_TABLE_SQL = `
CREATE TABLE app.password_reset_challenges (
  challenge_id uuid NOT NULL,
  user_id uuid NOT NULL,
  code_digest text COLLATE "C" NOT NULL,
  key_version integer NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,
  superseded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT password_reset_challenges_pkey PRIMARY KEY (challenge_id),
  CONSTRAINT password_reset_challenges_user_fkey FOREIGN KEY (user_id)
    REFERENCES app.users (user_id) ON DELETE RESTRICT,
  CONSTRAINT password_reset_challenges_code_digest_sha256 CHECK (code_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT password_reset_challenges_key_version_positive CHECK (key_version > 0),
  CONSTRAINT password_reset_challenges_attempts_bounded CHECK (
    max_attempts = 5 AND attempt_count BETWEEN 0 AND max_attempts
  ),
  CONSTRAINT password_reset_challenges_expiry_after_creation CHECK (expires_at > created_at),
  CONSTRAINT password_reset_challenges_terminal_state CHECK (
    NOT (consumed_at IS NOT NULL AND superseded_at IS NOT NULL)
    AND (consumed_at IS NULL OR consumed_at >= created_at)
    AND (superseded_at IS NULL OR superseded_at >= created_at)
  )
);
`.trim();

export const DATABASE_IDENTITY_ACCESS_RESET_INDEXES_SQL = `
CREATE UNIQUE INDEX password_reset_challenges_one_current_idx
ON app.password_reset_challenges (user_id)
WHERE consumed_at IS NULL AND superseded_at IS NULL;

CREATE INDEX password_reset_challenges_lookup_idx
ON app.password_reset_challenges (user_id, created_at DESC)
INCLUDE (
  challenge_id, code_digest, key_version, expires_at,
  attempt_count, max_attempts
);
`.trim();

export const DATABASE_IDENTITY_ACCESS_OUTBOX_SQL = `
ALTER TABLE app.identity_email_outbox
  ALTER COLUMN challenge_id DROP NOT NULL,
  ADD COLUMN password_reset_challenge_id uuid NULL,
  ADD CONSTRAINT identity_email_outbox_password_reset_challenge_fkey
    FOREIGN KEY (password_reset_challenge_id)
    REFERENCES app.password_reset_challenges (challenge_id) ON DELETE RESTRICT,
  ADD CONSTRAINT identity_email_outbox_password_reset_challenge_key
    UNIQUE (password_reset_challenge_id);
`.trim();

export const DATABASE_IDENTITY_ACCESS_CONSTRAINTS_SQL = `
ALTER TABLE app.identity_email_outbox
  DROP CONSTRAINT identity_email_outbox_template_known,
  ADD CONSTRAINT identity_email_outbox_template_known CHECK (
    template_key IN ('email_verification_v1', 'password_reset_v1')
  ),
  ADD CONSTRAINT identity_email_outbox_exactly_one_challenge CHECK (
    num_nonnulls(challenge_id, password_reset_challenge_id) = 1
  ),
  ADD CONSTRAINT identity_email_outbox_template_coherent CHECK (
    (template_key = 'email_verification_v1'
      AND challenge_id IS NOT NULL
      AND password_reset_challenge_id IS NULL)
    OR
    (template_key = 'password_reset_v1'
      AND challenge_id IS NULL
      AND password_reset_challenge_id IS NOT NULL)
  );

ALTER TABLE app.identity_rate_limits
  DROP CONSTRAINT identity_rate_limits_scope_known,
  ADD CONSTRAINT identity_rate_limits_scope_known CHECK (
    scope IN (
      'signup_ip', 'signup_email', 'verify_ip', 'verify_challenge',
      'resend_ip', 'resend_email', 'sign_in_ip', 'sign_in_email',
      'refresh_session', 'sign_out', 'revoke_all', 'reset_request_ip',
      'reset_request_email', 'reset_confirm_ip', 'reset_challenge'
    )
  );

ALTER TABLE app.identity_idempotency
  DROP CONSTRAINT identity_idempotency_endpoint_known,
  DROP CONSTRAINT identity_idempotency_response_known,
  ADD CONSTRAINT identity_idempotency_endpoint_known CHECK (
    endpoint IN (
      'sign_up', 'verify_email', 'resend_verification', 'sign_in',
      'refresh_session', 'sign_out', 'revoke_all_sessions',
      'request_password_reset', 'confirm_password_reset'
    )
  ),
  ADD CONSTRAINT identity_idempotency_response_known CHECK (
    response_kind IN (
      'accepted', 'verified', 'already_verified', 'invalid_code', 'expired',
      'attempts_exhausted', 'cooldown', 'authenticated', 'signed_out',
      'sessions_revoked', 'session_invalid', 'credentials_invalid',
      'password_reset_requested', 'password_reset', 'password_reset_invalid'
    )
  );

ALTER TABLE app.identity_audit_events
  DROP CONSTRAINT identity_audit_events_type_known,
  DROP CONSTRAINT identity_audit_events_metadata_allowlist,
  ADD CONSTRAINT identity_audit_events_type_known CHECK (
    event_type IN (
      'signup_accepted', 'signup_existing', 'verification_failed',
      'email_verified', 'verification_resent', 'resend_ignored',
      'sign_in_succeeded', 'session_refreshed', 'session_signed_out',
      'sessions_revoked', 'password_reset_requested',
      'password_reset_ignored', 'password_reset_failed',
      'password_reset_completed'
    )
  ),
  ADD CONSTRAINT identity_audit_events_metadata_allowlist CHECK (
    (metadata - ARRAY[
      'challenge_id', 'session_id', 'reason_code', 'idempotent_replay',
      'revoked_session_count'
    ]::text[]) = '{}'::jsonb
  );
`.trim();

const identityAccessContractDefinition = Object.freeze({
  migrationId: 4,
  migrationName: DATABASE_IDENTITY_ACCESS_MIGRATION_NAME,
  contractVersion: DATABASE_IDENTITY_ACCESS_CONTRACT_VERSION,
  fileName: DATABASE_IDENTITY_ACCESS_MIGRATION_NAME,
  minimumCompatibleMigrationId: 1,
});

export const DATABASE_IDENTITY_ACCESS_SUPERSEDE_SIGNUP_CONTRACT_SQL = `
UPDATE infra.migration_contracts
SET superseded_at = GREATEST(CURRENT_TIMESTAMP, applied_at)
WHERE migration_id = ${identitySignupContract.migrationId}
  AND superseded_at IS NULL;
`.trim();

const identityAccessCanonicalDefinition = [
  IDENTITY_ACCESS_MIGRATION_SOURCE_SHA256,
  DATABASE_IDENTITY_ACCESS_CREDENTIAL_VERSION_SQL,
  DATABASE_IDENTITY_ACCESS_RESET_TABLE_SQL,
  DATABASE_IDENTITY_ACCESS_RESET_INDEXES_SQL,
  DATABASE_IDENTITY_ACCESS_OUTBOX_SQL,
  DATABASE_IDENTITY_ACCESS_CONSTRAINTS_SQL,
  DATABASE_IDENTITY_ACCESS_SUPERSEDE_SIGNUP_CONTRACT_SQL,
  JSON.stringify(identityAccessContractDefinition),
].join("\n");

const identityAccessChecksum = createHash("sha256")
  .update(identityAccessCanonicalDefinition, "utf8")
  .digest("hex");

const identityAccessContract = Object.freeze({
  ...identityAccessContractDefinition,
  checksum: identityAccessChecksum,
});

export const DATABASE_IDENTITY_ACCESS_RESTORE_SIGNUP_CONTRACT_SQL = `
UPDATE infra.migration_contracts
SET superseded_at = NULL
WHERE migration_id = ${identitySignupContract.migrationId};
`.trim();

export const DATABASE_IDENTITY_ACCESS_CONTRACT_INSERT_SQL = `
INSERT INTO infra.migration_contracts (
  migration_id,
  migration_name,
  contract_version,
  checksum,
  minimum_compatible_migration_id
)
VALUES (
  ${identityAccessContract.migrationId},
  ${quoteSqlLiteral(identityAccessContract.migrationName)},
  ${quoteSqlLiteral(identityAccessContract.contractVersion)},
  ${quoteSqlLiteral(identityAccessContract.checksum)},
  ${identityAccessContract.minimumCompatibleMigrationId}
);
`.trim();

export const DATABASE_MIGRATION_MANIFEST = Object.freeze([
  baselineContract,
  featureFlagsContract,
  identitySignupContract,
  identityAccessContract,
]) satisfies readonly DatabaseMigrationManifestEntry[];
