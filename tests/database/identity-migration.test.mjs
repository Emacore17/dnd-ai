import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

import { runDatabaseMigrations } from "../../packages/persistence/dist/index.js";
import { withPostgresTestContainer } from "../../scripts/lib/postgres-test-container.mjs";

const { Client } = pg;
const EXPECTED_TABLES = [
  "email_verification_challenges",
  "identity_audit_events",
  "identity_email_outbox",
  "identity_idempotency",
  "identity_rate_limits",
  "password_reset_challenges",
  "user_credentials",
  "user_sessions",
  "users",
];

async function connect(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

async function expectConstraint(client, sql, values, constraint) {
  await assert.rejects(client.query(sql, values), (error) => {
    assert.equal(error.code, "23514");
    assert.equal(error.constraint, constraint);
    return true;
  });
}

test(
  "identity migration installs the versioned schema and privacy constraints",
  { timeout: 180_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      const migrated = await runDatabaseMigrations({
        count: 4,
        databaseUrl,
        direction: "up",
      });
      assert.equal(migrated.current, "000004_identity_access");

      const client = await connect(databaseUrl);
      try {
        const tables = await client.query(
          `SELECT table_name
             FROM information_schema.tables
            WHERE table_schema = 'app'
              AND table_name = ANY($1::text[])
            ORDER BY table_name`,
          [EXPECTED_TABLES],
        );
        assert.deepEqual(
          tables.rows.map(({ table_name: tableName }) => tableName),
          EXPECTED_TABLES,
        );

        const contract = await client.query(
          `SELECT migration_id,
                  migration_name,
                  contract_version,
                  minimum_compatible_migration_id,
                  superseded_at
             FROM infra.migration_contracts
            ORDER BY migration_id`,
        );
        assert.equal(contract.rowCount, 4);
        assert.deepEqual(contract.rows[3], {
          contract_version: "database-identity-access-v1",
          migration_id: 4,
          migration_name: "000004_identity_access",
          minimum_compatible_migration_id: 1,
          superseded_at: null,
        });
        assert.equal(
          contract.rows
            .slice(0, 3)
            .every(({ superseded_at }) => superseded_at instanceof Date),
          true,
        );

        const userId = "10000000-0000-4000-8000-000000000001";
        await client.query(
          `INSERT INTO app.users (
             user_id, canonical_email, delivery_email, display_name
           ) VALUES ($1, 'player@example.test', 'player@example.test', 'Player')`,
          [userId],
        );

        await client.query(
          `INSERT INTO app.user_credentials (
             user_id, password_hash, pepper_version
           ) VALUES ($1, $2, 1)`,
          [
            userId,
            `$argon2id$v=19$m=19456,t=2,p=1$${"c2FsdA".repeat(4)}$${"aGFzaA".repeat(8)}`,
          ],
        );
        const credential = await client.query(
          `SELECT credential_version
             FROM app.user_credentials
            WHERE user_id = $1`,
          [userId],
        );
        assert.equal(credential.rows[0].credential_version, "1");
        await expectConstraint(
          client,
          "UPDATE app.user_credentials SET credential_version = 0 WHERE user_id = $1",
          [userId],
          "user_credentials_credential_version_positive",
        );

        await assert.rejects(
          client.query(
            `INSERT INTO app.users (
               user_id, canonical_email, delivery_email, display_name
             ) VALUES (
               '10000000-0000-4000-8000-000000000002',
               'player@example.test',
               'other@example.test',
               'Other'
             )`,
          ),
          (error) => {
            assert.equal(error.code, "23505");
            assert.equal(error.constraint, "users_canonical_email_key");
            return true;
          },
        );

        await expectConstraint(
          client,
          `INSERT INTO app.email_verification_challenges (
             challenge_id, user_id, code_digest, key_version, expires_at
           ) VALUES (
             '20000000-0000-4000-8000-000000000001', $1, $2, 1,
             CURRENT_TIMESTAMP + INTERVAL '10 minutes'
           )`,
          [userId, "not-a-digest"],
          "email_verification_challenges_code_digest_sha256",
        );

        await client.query(
          `INSERT INTO app.email_verification_challenges (
             challenge_id, user_id, code_digest, key_version, expires_at
           ) VALUES (
             '20000000-0000-4000-8000-000000000001', $1, $2, 1,
             CURRENT_TIMESTAMP + INTERVAL '10 minutes'
           )`,
          [userId, "a".repeat(64)],
        );
        await assert.rejects(
          client.query(
            `INSERT INTO app.email_verification_challenges (
               challenge_id, user_id, code_digest, key_version, expires_at
             ) VALUES (
               '20000000-0000-4000-8000-000000000002', $1, $2, 1,
               CURRENT_TIMESTAMP + INTERVAL '10 minutes'
             )`,
            [userId, "b".repeat(64)],
          ),
          (error) => {
            assert.equal(error.code, "23505");
            assert.equal(
              error.constraint,
              "email_verification_challenges_one_current_idx",
            );
            return true;
          },
        );

        await expectConstraint(
          client,
          `UPDATE app.email_verification_challenges
              SET attempt_count = 6
            WHERE challenge_id = '20000000-0000-4000-8000-000000000001'`,
          [],
          "email_verification_challenges_attempts_bounded",
        );

        await client.query(
          `INSERT INTO app.password_reset_challenges (
             challenge_id, user_id, code_digest, key_version, expires_at
           ) VALUES (
             '21000000-0000-4000-8000-000000000001', $1, $2, 11,
             CURRENT_TIMESTAMP + INTERVAL '10 minutes'
           )`,
          [userId, "b".repeat(64)],
        );
        await assert.rejects(
          client.query(
            `INSERT INTO app.password_reset_challenges (
               challenge_id, user_id, code_digest, key_version, expires_at
             ) VALUES (
               '21000000-0000-4000-8000-000000000002', $1, $2, 11,
               CURRENT_TIMESTAMP + INTERVAL '10 minutes'
             )`,
            [userId, "c".repeat(64)],
          ),
          (error) => {
            assert.equal(error.code, "23505");
            assert.equal(
              error.constraint,
              "password_reset_challenges_one_current_idx",
            );
            return true;
          },
        );
        await expectConstraint(
          client,
          `UPDATE app.password_reset_challenges
              SET attempt_count = 6
            WHERE challenge_id = '21000000-0000-4000-8000-000000000001'`,
          [],
          "password_reset_challenges_attempts_bounded",
        );

        await expectConstraint(
          client,
          `INSERT INTO app.user_sessions (
             session_id, user_id, token_digest, key_version,
             idle_expires_at, absolute_expires_at
           ) VALUES (
             '30000000-0000-4000-8000-000000000001', $1, $2, 1,
             CURRENT_TIMESTAMP + INTERVAL '1 day',
             CURRENT_TIMESTAMP + INTERVAL '30 days'
           )`,
          [userId, "raw-session-token"],
          "user_sessions_token_digest_sha256",
        );

        await client.query(
          `INSERT INTO app.identity_email_outbox (
             outbox_id, user_id, challenge_id, template_key, next_attempt_at
           ) VALUES (
             '40000000-0000-4000-8000-000000000001', $1,
             '20000000-0000-4000-8000-000000000001',
             'email_verification_v1', CURRENT_TIMESTAMP
           )`,
          [userId],
        );
        await client.query(
          `INSERT INTO app.identity_email_outbox (
             outbox_id, user_id, password_reset_challenge_id,
             template_key, next_attempt_at
           ) VALUES (
             '41000000-0000-4000-8000-000000000001', $1,
             '21000000-0000-4000-8000-000000000001',
             'password_reset_v1', CURRENT_TIMESTAMP
           )`,
          [userId],
        );
        await expectConstraint(
          client,
          `UPDATE app.identity_email_outbox
              SET challenge_id = '20000000-0000-4000-8000-000000000001'
            WHERE outbox_id = '41000000-0000-4000-8000-000000000001'`,
          [],
          "identity_email_outbox_exactly_one_challenge",
        );
        await assert.rejects(
          client.query(
            `INSERT INTO app.identity_email_outbox (
               outbox_id, user_id, challenge_id, template_key, next_attempt_at
             ) VALUES (
               '40000000-0000-4000-8000-000000000002', $1,
               '20000000-0000-4000-8000-000000000001',
               'email_verification_v1', CURRENT_TIMESTAMP
             )`,
            [userId],
          ),
          (error) => {
            assert.equal(error.code, "23505");
            assert.equal(
              error.constraint,
              "identity_email_outbox_challenge_key",
            );
            return true;
          },
        );

        await expectConstraint(
          client,
          `UPDATE app.identity_email_outbox
              SET status = 'leased', lease_until = NULL
            WHERE outbox_id = '40000000-0000-4000-8000-000000000001'`,
          [],
          "identity_email_outbox_lease_state_coherent",
        );

        await client.query(
          `INSERT INTO app.identity_idempotency (
             idempotency_id, actor_subject_hash, endpoint, key_digest,
             request_fingerprint, response_kind, expires_at
           ) VALUES (
             '50000000-0000-4000-8000-000000000001', $1, 'sign_up', $2,
             $3, 'accepted', CURRENT_TIMESTAMP + INTERVAL '24 hours'
           )`,
          ["c".repeat(64), "d".repeat(64), "e".repeat(64)],
        );
        await client.query(
          `INSERT INTO app.identity_idempotency (
             idempotency_id, actor_subject_hash, endpoint, key_digest,
             request_fingerprint, response_kind, expires_at
           ) VALUES (
             '50000000-0000-4000-8000-000000000003', $1, 'sign_in', $2,
             $3, 'authenticated', CURRENT_TIMESTAMP + INTERVAL '24 hours'
           )`,
          ["1".repeat(64), "2".repeat(64), "3".repeat(64)],
        );
        await expectConstraint(
          client,
          `INSERT INTO app.identity_idempotency (
             idempotency_id, actor_subject_hash, endpoint, key_digest,
             request_fingerprint, response_kind, expires_at
           ) VALUES (
             '50000000-0000-4000-8000-000000000004', $1, 'unknown_access', $2,
             $3, 'authenticated', CURRENT_TIMESTAMP + INTERVAL '24 hours'
           )`,
          ["4".repeat(64), "5".repeat(64), "6".repeat(64)],
          "identity_idempotency_endpoint_known",
        );
        await assert.rejects(
          client.query(
            `INSERT INTO app.identity_idempotency (
               idempotency_id, actor_subject_hash, endpoint, key_digest,
               request_fingerprint, response_kind, expires_at
             ) VALUES (
               '50000000-0000-4000-8000-000000000002', $1, 'sign_up', $2,
               $3, 'accepted', CURRENT_TIMESTAMP + INTERVAL '24 hours'
             )`,
            ["c".repeat(64), "d".repeat(64), "f".repeat(64)],
          ),
          (error) => {
            assert.equal(error.code, "23505");
            assert.equal(error.constraint, "identity_idempotency_scope_key");
            return true;
          },
        );

        await expectConstraint(
          client,
          `INSERT INTO app.identity_audit_events (
             event_type, user_id, metadata
           ) VALUES ('signup_accepted', $1, $2::jsonb)`,
          [userId, JSON.stringify({ email: "player@example.test" })],
          "identity_audit_events_metadata_allowlist",
        );

        const audit = await client.query(
          `INSERT INTO app.identity_audit_events (
             event_type, user_id, metadata
           ) VALUES ('signup_accepted', $1, '{}'::jsonb)
           RETURNING event_id`,
          [userId],
        );
        await client.query(
          `INSERT INTO app.identity_audit_events (
             event_type, user_id, metadata
           ) VALUES (
             'password_reset_completed', $1,
             '{"revoked_session_count": 1}'::jsonb
           )`,
          [userId],
        );
        await expectConstraint(
          client,
          `INSERT INTO app.identity_audit_events (
             event_type, user_id, metadata
           ) VALUES ('unknown_access_event', $1, '{}'::jsonb)`,
          [userId],
          "identity_audit_events_type_known",
        );

        await client.query(
          `INSERT INTO app.identity_rate_limits (
             scope, subject_hash, window_started_at, window_expires_at,
             hit_count, limit_count, updated_at
           ) VALUES (
             'sign_in_ip', $1, CURRENT_TIMESTAMP,
             CURRENT_TIMESTAMP + INTERVAL '15 minutes', 1, 10,
             CURRENT_TIMESTAMP
           )`,
          ["7".repeat(64)],
        );
        await expectConstraint(
          client,
          `INSERT INTO app.identity_rate_limits (
             scope, subject_hash, window_started_at, window_expires_at,
             hit_count, limit_count, updated_at
           ) VALUES (
             'unknown_access', $1, CURRENT_TIMESTAMP,
             CURRENT_TIMESTAMP + INTERVAL '15 minutes', 1, 10,
             CURRENT_TIMESTAMP
           )`,
          ["8".repeat(64)],
          "identity_rate_limits_scope_known",
        );
        for (const statement of [
          "UPDATE app.identity_audit_events SET metadata = '{}'::jsonb WHERE event_id = $1",
          "DELETE FROM app.identity_audit_events WHERE event_id = $1",
        ]) {
          await assert.rejects(
            client.query(statement, [audit.rows[0].event_id]),
            (error) => {
              assert.equal(error.code, "55000");
              assert.equal(
                error.message,
                "identity audit events are append-only",
              );
              return true;
            },
          );
        }
      } finally {
        await client.end();
      }
    });
  },
);

test(
  "identity access migration upgrades from 000003, rolls back and re-applies locally",
  { timeout: 180_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      const first = await runDatabaseMigrations({
        count: 3,
        databaseUrl,
        direction: "up",
      });
      assert.equal(first.current, "000003_identity_signup");

      const skewedClockClient = await connect(databaseUrl);
      try {
        await skewedClockClient.query(
          `UPDATE infra.migration_contracts
              SET applied_at = CURRENT_TIMESTAMP + INTERVAL '5 minutes'
            WHERE migration_id = 3`,
        );
      } finally {
        await skewedClockClient.end();
      }

      const upgraded = await runDatabaseMigrations({
        count: 1,
        databaseUrl,
        direction: "up",
      });
      assert.deepEqual(upgraded.applied, ["000004_identity_access"]);

      const rolledBack = await runDatabaseMigrations({
        allowDestructiveRollback: true,
        count: 1,
        databaseUrl,
        direction: "down",
      });
      assert.equal(rolledBack.current, "000003_identity_signup");

      const client = await connect(databaseUrl);
      try {
        const accessTable = await client.query(
          "SELECT to_regclass('app.password_reset_challenges') AS table_name",
        );
        assert.equal(accessTable.rows[0].table_name, null);
        const accessColumns = await client.query(
          `SELECT column_name
             FROM information_schema.columns
            WHERE table_schema = 'app'
              AND table_name IN ('user_credentials', 'identity_email_outbox')
              AND column_name IN ('credential_version', 'password_reset_challenge_id')`,
        );
        assert.equal(accessColumns.rowCount, 0);
        const legacyTables = await client.query(
          `SELECT count(*)::integer AS count
             FROM information_schema.tables
            WHERE table_schema = 'app'
              AND table_name = ANY($1::text[])`,
          [
            EXPECTED_TABLES.filter(
              (name) => name !== "password_reset_challenges",
            ),
          ],
        );
        assert.equal(legacyTables.rows[0].count, EXPECTED_TABLES.length - 1);
      } finally {
        await client.end();
      }

      const reapplied = await runDatabaseMigrations({
        count: 1,
        databaseUrl,
        direction: "up",
      });
      assert.deepEqual(reapplied.applied, ["000004_identity_access"]);
    });
  },
);
