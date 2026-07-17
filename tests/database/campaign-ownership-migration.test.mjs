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
const NOW = new Date("2026-07-17T12:00:00.000Z");
const USER_A = "10000000-0000-4000-8000-000000000001";
const USER_B = "10000000-0000-4000-8000-000000000002";
const CAMPAIGN_A = "70000000-0000-7000-8000-000000000001";

async function connect(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

async function seedActiveUser(client, userId, ordinal) {
  await client.query(
    `INSERT INTO app.users (
       user_id, canonical_email, delivery_email, display_name,
       status, created_at, activated_at, updated_at
     ) VALUES ($1, $2, $2, $3, 'active', $4, $4, $4)`,
    [userId, `player${ordinal}@example.test`, `Player ${ordinal}`, NOW],
  );
}

async function expectConstraint(client, sql, values, code, constraint) {
  await assert.rejects(client.query(sql, values), (error) => {
    assert.equal(error.code, code);
    assert.equal(error.constraint, constraint);
    return true;
  });
}

function campaignId(ordinal) {
  return `70000000-0000-7000-8000-${String(ordinal).padStart(12, "0")}`;
}

test(
  "campaign ownership migration installs tenant constraints and active ledger",
  { timeout: 180_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      const migrated = await runDatabaseMigrations({
        databaseUrl,
        direction: "up",
      });
      assert.equal(DATABASE_MIGRATION_HEAD, "000005_campaign_ownership");
      assert.equal(DATABASE_CONTRACT_VERSION, "database-campaign-ownership-v1");
      assert.equal(migrated.current, DATABASE_MIGRATION_HEAD);

      const client = await connect(databaseUrl);
      try {
        await seedActiveUser(client, USER_A, 1);
        await seedActiveUser(client, USER_B, 2);
        await client.query(
          `INSERT INTO app.campaigns (
             campaign_id, user_id, title, status, state_version,
             created_at, updated_at
           ) VALUES ($1, $2, 'Nebbia su Corva', 'active', 1, $3, $3)`,
          [CAMPAIGN_A, USER_A, NOW],
        );

        const stored = await client.query(
          `SELECT campaign_id, user_id, title, status, state_version,
                  created_at, updated_at, deleted_at
             FROM app.campaigns
            WHERE campaign_id = $1`,
          [CAMPAIGN_A],
        );
        assert.equal(stored.rowCount, 1);
        assert.equal(stored.rows[0].user_id, USER_A);
        assert.equal(stored.rows[0].state_version, "1");
        assert.equal(stored.rows[0].deleted_at, null);

        await expectConstraint(
          client,
          `INSERT INTO app.campaigns (campaign_id, user_id, title)
           VALUES ('60000000-0000-4000-8000-000000000001', $1, 'ID errato')`,
          [USER_A],
          "23514",
          "campaigns_id_uuidv7",
        );
        await expectConstraint(
          client,
          `INSERT INTO app.campaigns (campaign_id, user_id, title)
           VALUES ($1, '10000000-0000-4000-8000-000000000099', 'Owner assente')`,
          [campaignId(2)],
          "23503",
          "campaigns_user_fkey",
        );
        await expectConstraint(
          client,
          `INSERT INTO app.campaigns (campaign_id, user_id, title)
           VALUES ($1, $2, '   ')`,
          [campaignId(3), USER_A],
          "23514",
          "campaigns_title_bounded",
        );
        await expectConstraint(
          client,
          `INSERT INTO app.campaigns (campaign_id, user_id, title)
           VALUES ($1, $2, $3)`,
          [campaignId(4), USER_A, "x".repeat(81)],
          "23514",
          "campaigns_title_bounded",
        );
        await expectConstraint(
          client,
          `INSERT INTO app.campaigns (campaign_id, user_id, title, status)
           VALUES ($1, $2, 'Status errato', 'hidden')`,
          [campaignId(5), USER_A],
          "23514",
          "campaigns_status_known",
        );
        await expectConstraint(
          client,
          `INSERT INTO app.campaigns (
             campaign_id, user_id, title, state_version
           ) VALUES ($1, $2, 'Versione errata', -1)`,
          [campaignId(6), USER_A],
          "23514",
          "campaigns_state_version_bounded",
        );
        await expectConstraint(
          client,
          `INSERT INTO app.campaigns (
             campaign_id, user_id, title, created_at, updated_at
           ) VALUES (
             $1, $2, 'Tempo errato',
             $3::timestamptz, $3::timestamptz - INTERVAL '1 second'
           )`,
          [campaignId(7), USER_A, NOW],
          "23514",
          "campaigns_timestamps_coherent",
        );
        await expectConstraint(
          client,
          `INSERT INTO app.campaigns (
             campaign_id, user_id, title, created_at, updated_at, deleted_at
           ) VALUES (
             $1, $2, 'Delete errato',
             $3::timestamptz, $3::timestamptz,
             $3::timestamptz - INTERVAL '1 second'
           )`,
          [campaignId(8), USER_A, NOW],
          "23514",
          "campaigns_timestamps_coherent",
        );

        const index = await client.query(
          `SELECT indexdef
             FROM pg_indexes
            WHERE schemaname = 'app'
              AND indexname = 'campaigns_owner_lookup_idx'`,
        );
        assert.equal(index.rowCount, 1);
        assert.match(index.rows[0].indexdef, /\(user_id, campaign_id\)/u);
        assert.match(index.rows[0].indexdef, /deleted_at IS NULL/u);

        const contracts = await client.query(
          `SELECT migration_id, migration_name, contract_version, superseded_at
             FROM infra.migration_contracts
            ORDER BY migration_id`,
        );
        assert.equal(contracts.rowCount, 5);
        assert.deepEqual(contracts.rows[4], {
          contract_version: "database-campaign-ownership-v1",
          migration_id: 5,
          migration_name: "000005_campaign_ownership",
          superseded_at: null,
        });
        assert.equal(
          contracts.rows
            .slice(0, 4)
            .every(
              ({ superseded_at: supersededAt }) => supersededAt instanceof Date,
            ),
          true,
        );
      } finally {
        await client.end();
      }
    });
  },
);

test(
  "campaign ownership migration upgrades from 000004 and rolls back locally",
  { timeout: 180_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      const previous = await runDatabaseMigrations({
        count: 4,
        databaseUrl,
        direction: "up",
      });
      assert.equal(previous.current, "000004_identity_access");

      const upgraded = await runDatabaseMigrations({
        databaseUrl,
        direction: "up",
      });
      assert.deepEqual(upgraded.applied, ["000005_campaign_ownership"]);

      const rolledBack = await runDatabaseMigrations({
        allowDestructiveRollback: true,
        count: 1,
        databaseUrl,
        direction: "down",
      });
      assert.equal(rolledBack.current, "000004_identity_access");

      const client = await connect(databaseUrl);
      try {
        const table = await client.query(
          "SELECT to_regclass('app.campaigns') AS table_name",
        );
        assert.equal(table.rows[0].table_name, null);
        const activeContract = await client.query(
          `SELECT migration_id, superseded_at
             FROM infra.migration_contracts
            WHERE superseded_at IS NULL`,
        );
        assert.deepEqual(activeContract.rows, [
          { migration_id: 4, superseded_at: null },
        ]);
      } finally {
        await client.end();
      }

      const reapplied = await runDatabaseMigrations({
        databaseUrl,
        direction: "up",
      });
      assert.deepEqual(reapplied.applied, ["000005_campaign_ownership"]);
    });
  },
);
