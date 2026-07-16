import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

import {
  DATABASE_CONTRACT_VERSION,
  DATABASE_MIGRATION_HEAD,
  runDatabaseMigrations,
} from "../../packages/persistence/dist/index.js";
import { withPostgresTestContainer } from "../../scripts/lib/postgres-test-container.mjs";

const { Client } = pg;
const EXPECTED_TABLES = [
  "email_verification_challenges",
  "identity_audit_events",
  "identity_email_outbox",
  "identity_idempotency",
  "identity_rate_limits",
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
        databaseUrl,
        direction: "up",
      });
      assert.equal(DATABASE_MIGRATION_HEAD, "000003_identity_signup");
      assert.equal(DATABASE_CONTRACT_VERSION, "database-identity-signup-v1");
      assert.equal(migrated.current, DATABASE_MIGRATION_HEAD);

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
        assert.equal(contract.rowCount, 3);
        assert.deepEqual(contract.rows[2], {
          contract_version: "database-identity-signup-v1",
          migration_id: 3,
          migration_name: "000003_identity_signup",
          minimum_compatible_migration_id: 1,
          superseded_at: null,
        });
        assert.equal(contract.rows[1].superseded_at instanceof Date, true);

        const userId = "10000000-0000-4000-8000-000000000001";
        await client.query(
          `INSERT INTO app.users (
             user_id, canonical_email, delivery_email, display_name
           ) VALUES ($1, 'player@example.test', 'player@example.test', 'Player')`,
          [userId],
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
  "identity migration upgrades from 000002 and rolls back locally",
  { timeout: 180_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      const first = await runDatabaseMigrations({
        count: 2,
        databaseUrl,
        direction: "up",
      });
      assert.equal(first.current, "000002_feature_flags");

      const skewedClockClient = await connect(databaseUrl);
      try {
        await skewedClockClient.query(
          `UPDATE infra.migration_contracts
              SET applied_at = CURRENT_TIMESTAMP + INTERVAL '5 minutes'
            WHERE migration_id = 2`,
        );
      } finally {
        await skewedClockClient.end();
      }

      const upgraded = await runDatabaseMigrations({
        databaseUrl,
        direction: "up",
      });
      assert.deepEqual(upgraded.applied, ["000003_identity_signup"]);

      const rolledBack = await runDatabaseMigrations({
        allowDestructiveRollback: true,
        count: 1,
        databaseUrl,
        direction: "down",
      });
      assert.equal(rolledBack.current, "000002_feature_flags");

      const client = await connect(databaseUrl);
      try {
        const tables = await client.query(
          `SELECT count(*)::integer AS count
             FROM information_schema.tables
            WHERE table_schema = 'app'
              AND table_name = ANY($1::text[])`,
          [EXPECTED_TABLES],
        );
        assert.equal(tables.rows[0].count, 0);
      } finally {
        await client.end();
      }
    });
  },
);
