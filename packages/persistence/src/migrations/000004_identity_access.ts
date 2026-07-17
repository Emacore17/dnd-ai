import type { MigrationBuilder } from "node-pg-migrate";

import {
  DATABASE_IDENTITY_ACCESS_CONSTRAINTS_SQL,
  DATABASE_IDENTITY_ACCESS_CONTRACT_INSERT_SQL,
  DATABASE_IDENTITY_ACCESS_CREDENTIAL_VERSION_SQL,
  DATABASE_IDENTITY_ACCESS_OUTBOX_SQL,
  DATABASE_IDENTITY_ACCESS_RESET_INDEXES_SQL,
  DATABASE_IDENTITY_ACCESS_RESET_TABLE_SQL,
  DATABASE_IDENTITY_ACCESS_RESTORE_SIGNUP_CONTRACT_SQL,
  DATABASE_IDENTITY_ACCESS_SUPERSEDE_SIGNUP_CONTRACT_SQL,
} from "../migration-manifest.js";

export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.sql(DATABASE_IDENTITY_ACCESS_CREDENTIAL_VERSION_SQL);
  pgm.sql(DATABASE_IDENTITY_ACCESS_RESET_TABLE_SQL);
  pgm.sql(DATABASE_IDENTITY_ACCESS_RESET_INDEXES_SQL);
  pgm.sql(DATABASE_IDENTITY_ACCESS_OUTBOX_SQL);
  pgm.sql(DATABASE_IDENTITY_ACCESS_CONSTRAINTS_SQL);
  pgm.sql(DATABASE_IDENTITY_ACCESS_SUPERSEDE_SIGNUP_CONTRACT_SQL);
  pgm.sql(DATABASE_IDENTITY_ACCESS_CONTRACT_INSERT_SQL);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql("DELETE FROM infra.migration_contracts WHERE migration_id = 4;");
  pgm.sql(`
    ALTER TABLE app.identity_audit_events
      DROP CONSTRAINT identity_audit_events_type_known,
      DROP CONSTRAINT identity_audit_events_metadata_allowlist,
      ADD CONSTRAINT identity_audit_events_type_known CHECK (
        event_type IN (
          'signup_accepted', 'signup_existing', 'verification_failed',
          'email_verified', 'verification_resent', 'resend_ignored'
        )
      ),
      ADD CONSTRAINT identity_audit_events_metadata_allowlist CHECK (
        (metadata - ARRAY[
          'challenge_id', 'session_id', 'reason_code', 'idempotent_replay'
        ]::text[]) = '{}'::jsonb
      );

    ALTER TABLE app.identity_idempotency
      DROP CONSTRAINT identity_idempotency_endpoint_known,
      DROP CONSTRAINT identity_idempotency_response_known,
      ADD CONSTRAINT identity_idempotency_endpoint_known CHECK (
        endpoint IN ('sign_up', 'verify_email', 'resend_verification')
      ),
      ADD CONSTRAINT identity_idempotency_response_known CHECK (
        response_kind IN (
          'accepted', 'verified', 'already_verified', 'invalid_code',
          'expired', 'attempts_exhausted', 'cooldown'
        )
      );

    ALTER TABLE app.identity_rate_limits
      DROP CONSTRAINT identity_rate_limits_scope_known,
      ADD CONSTRAINT identity_rate_limits_scope_known CHECK (
        scope IN (
          'signup_ip', 'signup_email', 'verify_ip', 'verify_challenge',
          'resend_ip', 'resend_email'
        )
      );

    ALTER TABLE app.identity_email_outbox
      DROP CONSTRAINT identity_email_outbox_template_coherent,
      DROP CONSTRAINT identity_email_outbox_exactly_one_challenge,
      DROP CONSTRAINT identity_email_outbox_template_known,
      DROP CONSTRAINT identity_email_outbox_password_reset_challenge_key,
      DROP CONSTRAINT identity_email_outbox_password_reset_challenge_fkey,
      ADD CONSTRAINT identity_email_outbox_template_known CHECK (
        template_key = 'email_verification_v1'
      ),
      ALTER COLUMN challenge_id SET NOT NULL,
      DROP COLUMN password_reset_challenge_id;

    DROP TABLE app.password_reset_challenges RESTRICT;

    ALTER TABLE app.user_credentials
      DROP CONSTRAINT user_credentials_credential_version_positive,
      DROP COLUMN credential_version;
  `);
  pgm.sql(DATABASE_IDENTITY_ACCESS_RESTORE_SIGNUP_CONTRACT_SQL);
}
