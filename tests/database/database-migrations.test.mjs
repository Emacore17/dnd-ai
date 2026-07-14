import assert from "node:assert/strict";
import { unlink, writeFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import pg from "pg";

import {
  DATABASE_CONTRACT_VERSION,
  DATABASE_MIGRATION_HEAD,
  DATABASE_MIGRATION_LOCK_VALUE,
  DatabaseMigrationError,
  getDatabaseMigrationStatus,
  runDatabaseMigrations,
} from "../../packages/persistence/dist/index.js";
import { withPostgresTestContainer } from "../../scripts/lib/postgres-test-container.mjs";

const { Client } = pg;
const unknownMigrationPath = fileURLToPath(
  new URL(
    "../../packages/persistence/dist/migrations/000002_unknown_migration.js",
    import.meta.url,
  ),
);
const expectedConstraintNames = Object.freeze([
  "migration_contracts_checksum_sha256",
  "migration_contracts_compatibility_range",
  "migration_contracts_contract_version_not_blank",
  "migration_contracts_migration_id_positive",
  "migration_contracts_migration_name_key",
  "migration_contracts_migration_name_not_blank",
  "migration_contracts_pkey",
  "migration_contracts_superseded_after_applied",
]);

async function connect(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

function assertFrozenStatus(status, expected) {
  assert.deepEqual(status, expected);
  assert.equal(Object.isFrozen(status), true);
  assert.equal(Object.isFrozen(status.applied), true);
  assert.equal(Object.isFrozen(status.pending), true);
}

async function schemaExists(client, schemaName) {
  const result = await client.query(
    "SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1) AS present",
    [schemaName],
  );
  return result.rows[0].present;
}

async function tableExists(client, schemaName, tableName) {
  const result = await client.query(
    "SELECT to_regclass($1) IS NOT NULL AS present",
    [`${schemaName}.${tableName}`],
  );
  return result.rows[0].present;
}

test(
  "PostgreSQL baseline migrates, replays, rolls back locally and locks concurrent runners",
  { timeout: 180_000 },
  async (context) => {
    await withPostgresTestContainer(async ({ databaseUrl, host, port }) => {
      assert.equal(host, "127.0.0.1");
      assert.ok(Number.isInteger(port));

      assertFrozenStatus(await getDatabaseMigrationStatus({ databaseUrl }), {
        applied: [],
        contractVersion: null,
        current: null,
        pending: [DATABASE_MIGRATION_HEAD],
      });

      await context.test(
        "rejects an unknown compiled migration before database mutation",
        async () => {
          await writeFile(
            unknownMigrationPath,
            'export function up(pgm) { pgm.createTable("unknown_table", { id: "uuid" }); }\n',
            "utf8",
          );

          try {
            await assert.rejects(
              runDatabaseMigrations({ databaseUrl, direction: "up" }),
              (error) => {
                assert.equal(error instanceof DatabaseMigrationError, true);
                assert.equal(error.code, "STATE_DRIFT");
                return true;
              },
            );

            const inspectionClient = await connect(databaseUrl);
            try {
              assert.equal(await schemaExists(inspectionClient, "app"), false);
              assert.equal(
                await tableExists(inspectionClient, "public", "unknown_table"),
                false,
              );
            } finally {
              await inspectionClient.end();
            }
          } finally {
            await unlink(unknownMigrationPath);
          }
        },
      );

      await context.test(
        "migrates an empty database to the declared head",
        async () => {
          const result = await runDatabaseMigrations({
            databaseUrl,
            direction: "up",
          });

          assert.deepEqual(result, {
            applied: [DATABASE_MIGRATION_HEAD],
            current: DATABASE_MIGRATION_HEAD,
            direction: "up",
          });
          assert.equal(Object.isFrozen(result), true);
          assert.equal(Object.isFrozen(result.applied), true);
        },
      );

      const client = await connect(databaseUrl);

      try {
        await context.test(
          "installs vector and the app and infra schema contracts",
          async () => {
            const extension = await client.query(
              "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
            );
            assert.equal(extension.rowCount, 1);
            assert.equal(extension.rows[0].extversion, "0.8.2");

            assert.equal(await schemaExists(client, "app"), true);
            assert.equal(await schemaExists(client, "infra"), true);
            assert.equal(
              await tableExists(client, "infra", "schema_migrations"),
              true,
            );
            assert.equal(
              await tableExists(client, "infra", "migration_contracts"),
              true,
            );

            const ledger = await client.query(
              "SELECT name FROM infra.schema_migrations ORDER BY id",
            );
            assert.deepEqual(ledger.rows, [{ name: DATABASE_MIGRATION_HEAD }]);

            const contract = await client.query(
              `SELECT migration_id,
                      migration_name,
                      contract_version,
                      checksum,
                      minimum_compatible_migration_id,
                      applied_at,
                      superseded_at
                 FROM infra.migration_contracts`,
            );
            assert.equal(contract.rowCount, 1);
            assert.equal(contract.rows[0].migration_id, 1);
            assert.equal(
              contract.rows[0].migration_name,
              DATABASE_MIGRATION_HEAD,
            );
            assert.equal(
              contract.rows[0].contract_version,
              DATABASE_CONTRACT_VERSION,
            );
            assert.match(contract.rows[0].checksum, /^[a-f0-9]{64}$/u);
            assert.equal(contract.rows[0].minimum_compatible_migration_id, 1);
            assert.equal(contract.rows[0].applied_at instanceof Date, true);
            assert.equal(contract.rows[0].superseded_at, null);
          },
        );

        await context.test(
          "exposes named constraints and enforces one active contract",
          async () => {
            const constraints = await client.query(
              `SELECT constraint_name
                 FROM information_schema.table_constraints
                WHERE table_schema = 'infra'
                  AND table_name = 'migration_contracts'
                  AND constraint_name LIKE 'migration_contracts_%'
                ORDER BY constraint_name`,
            );
            assert.deepEqual(
              constraints.rows.map(({ constraint_name: name }) => name),
              expectedConstraintNames,
            );

            const index = await client.query(
              `SELECT indexdef
                 FROM pg_indexes
                WHERE schemaname = 'infra'
                  AND tablename = 'migration_contracts'
                  AND indexname = 'migration_contracts_one_active_idx'`,
            );
            assert.equal(index.rowCount, 1);
            assert.match(index.rows[0].indexdef, /CREATE UNIQUE INDEX/u);
            assert.match(
              index.rows[0].indexdef,
              /WHERE \(superseded_at IS NULL\)/u,
            );

            await assert.rejects(
              client.query(
                `INSERT INTO infra.migration_contracts (
                   migration_id,
                   migration_name,
                   contract_version,
                   checksum,
                   minimum_compatible_migration_id
                 ) VALUES ($1, $2, $3, $4, $5)`,
                [
                  2,
                  "000002_future_contract",
                  "future-contract-v1",
                  "a".repeat(64),
                  1,
                ],
              ),
              (error) => {
                assert.equal(error.code, "23505");
                assert.equal(
                  error.constraint,
                  "migration_contracts_one_active_idx",
                );
                return true;
              },
            );
          },
        );

        await context.test("replay is a stable no-op", async () => {
          const replay = await runDatabaseMigrations({
            databaseUrl,
            direction: "up",
          });
          assert.deepEqual(replay, {
            applied: [],
            current: DATABASE_MIGRATION_HEAD,
            direction: "up",
          });
          assertFrozenStatus(
            await getDatabaseMigrationStatus({ databaseUrl }),
            {
              applied: [DATABASE_MIGRATION_HEAD],
              contractVersion: DATABASE_CONTRACT_VERSION,
              current: DATABASE_MIGRATION_HEAD,
              pending: [],
            },
          );
        });

        await context.test(
          "checksum drift fails closed before another migration can run",
          async () => {
            const original = await client.query(
              "SELECT checksum FROM infra.migration_contracts WHERE migration_id = 1",
            );
            const originalChecksum = original.rows[0].checksum;

            await client.query(
              "UPDATE infra.migration_contracts SET checksum = $1 WHERE migration_id = 1",
              ["b".repeat(64)],
            );

            try {
              await assert.rejects(
                getDatabaseMigrationStatus({ databaseUrl }),
                (error) => {
                  assert.equal(error instanceof DatabaseMigrationError, true);
                  assert.equal(error.code, "STATE_DRIFT");
                  assert.doesNotMatch(error.message, /b{64}/u);
                  return true;
                },
              );
            } finally {
              await client.query(
                "UPDATE infra.migration_contracts SET checksum = $1 WHERE migration_id = 1",
                [originalChecksum],
              );
            }

            assertFrozenStatus(
              await getDatabaseMigrationStatus({ databaseUrl }),
              {
                applied: [DATABASE_MIGRATION_HEAD],
                contractVersion: DATABASE_CONTRACT_VERSION,
                current: DATABASE_MIGRATION_HEAD,
                pending: [],
              },
            );
          },
        );

        await context.test(
          "an occupied advisory lock fails closed with a redacted domain error",
          async () => {
            await client.query("SELECT pg_advisory_lock($1::bigint)", [
              String(DATABASE_MIGRATION_LOCK_VALUE),
            ]);

            try {
              await assert.rejects(
                runDatabaseMigrations({ databaseUrl, direction: "up" }),
                (error) => {
                  assert.equal(error instanceof DatabaseMigrationError, true);
                  assert.equal(typeof error.code, "string");
                  assert.doesNotMatch(error.message, /postgres(?:ql)?:\/\//iu);
                  assert.doesNotMatch(
                    error.message,
                    /local_test_only_password/iu,
                  );
                  return true;
                },
              );
            } finally {
              await client.query("SELECT pg_advisory_unlock($1::bigint)", [
                String(DATABASE_MIGRATION_LOCK_VALUE),
              ]);
            }
          },
        );

        await context.test(
          "a failed product rollback preserves the contract, ledger and schema",
          async () => {
            await client.query(
              "CREATE TABLE app.rollback_blocker (id integer PRIMARY KEY)",
            );

            try {
              await assert.rejects(
                runDatabaseMigrations({
                  allowDestructiveRollback: true,
                  count: 1,
                  databaseUrl,
                  direction: "down",
                }),
                (error) => {
                  assert.equal(error instanceof DatabaseMigrationError, true);
                  assert.equal(error.code, "EXECUTION_FAILED");
                  assert.doesNotMatch(error.message, /postgres(?:ql)?:\/\//iu);
                  return true;
                },
              );

              assert.equal(
                await tableExists(client, "app", "rollback_blocker"),
                true,
              );
              assert.equal(
                await tableExists(client, "infra", "migration_contracts"),
                true,
              );
              const ledger = await client.query(
                "SELECT name FROM infra.schema_migrations ORDER BY id",
              );
              assert.deepEqual(ledger.rows, [
                { name: DATABASE_MIGRATION_HEAD },
              ]);
              assertFrozenStatus(
                await getDatabaseMigrationStatus({ databaseUrl }),
                {
                  applied: [DATABASE_MIGRATION_HEAD],
                  contractVersion: DATABASE_CONTRACT_VERSION,
                  current: DATABASE_MIGRATION_HEAD,
                  pending: [],
                },
              );

              const lock = await client.query(
                "SELECT pg_try_advisory_lock($1::bigint) AS acquired",
                [String(DATABASE_MIGRATION_LOCK_VALUE)],
              );
              assert.equal(lock.rows[0].acquired, true);
              await client.query("SELECT pg_advisory_unlock($1::bigint)", [
                String(DATABASE_MIGRATION_LOCK_VALUE),
              ]);
            } finally {
              await client.query("DROP TABLE app.rollback_blocker");
            }
          },
        );

        await context.test(
          "explicit local rollback removes only the reversible baseline and can re-apply",
          async () => {
            const rolledBack = await runDatabaseMigrations({
              allowDestructiveRollback: true,
              count: 1,
              databaseUrl,
              direction: "down",
            });
            assert.deepEqual(rolledBack, {
              applied: [DATABASE_MIGRATION_HEAD],
              current: null,
              direction: "down",
            });

            assert.equal(await schemaExists(client, "app"), false);
            assert.equal(await schemaExists(client, "infra"), true);
            assert.equal(
              await tableExists(client, "infra", "schema_migrations"),
              true,
            );
            assert.equal(
              await tableExists(client, "infra", "migration_contracts"),
              false,
            );

            const extension = await client.query(
              "SELECT 1 FROM pg_extension WHERE extname = 'vector'",
            );
            assert.equal(extension.rowCount, 0);

            assertFrozenStatus(
              await getDatabaseMigrationStatus({ databaseUrl }),
              {
                applied: [],
                contractVersion: null,
                current: null,
                pending: [DATABASE_MIGRATION_HEAD],
              },
            );

            const reapplied = await runDatabaseMigrations({
              databaseUrl,
              direction: "up",
            });
            assert.deepEqual(reapplied, {
              applied: [DATABASE_MIGRATION_HEAD],
              current: DATABASE_MIGRATION_HEAD,
              direction: "up",
            });
          },
        );
      } finally {
        await client.end();
      }
    });
  },
);
