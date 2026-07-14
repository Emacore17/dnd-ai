import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { URL } from "node:url";

import pg from "pg";

import {
  DATABASE_MIGRATION_HEAD,
  DATABASE_MIGRATION_LOCK_VALUE,
  DatabaseMigrationError,
  runDatabaseMigrations,
} from "../../packages/persistence/dist/index.js";
import { withPostgresTestContainer } from "../../scripts/lib/postgres-test-container.mjs";

const requireFromPersistence = createRequire(
  new URL("../../packages/persistence/package.json", import.meta.url),
);
const { runner: nodePgMigrateRunner } =
  requireFromPersistence("node-pg-migrate");
const { Client } = pg;
const DDL_BARRIER_LOCK_VALUE = DATABASE_MIGRATION_LOCK_VALUE + 1;
const silentLogger = Object.freeze({
  debug() {},
  info() {},
  warn() {},
  error() {},
});

async function connect(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

async function waitForMigrationLock(databaseUrl) {
  const client = await connect(databaseUrl);

  try {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const result = await client.query(
        "SELECT pg_try_advisory_lock($1::bigint) AS acquired",
        [String(DATABASE_MIGRATION_LOCK_VALUE)],
      );

      if (result.rows[0].acquired === false) {
        return;
      }

      await client.query("SELECT pg_advisory_unlock($1::bigint)", [
        String(DATABASE_MIGRATION_LOCK_VALUE),
      ]);
      await delay(10);
    }
  } finally {
    await client.end();
  }

  assert.fail("migration runner did not acquire its advisory lock in time");
}

test(
  "simultaneous migration runners fail closed on the shared advisory lock",
  { timeout: 180_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      const setupClient = await connect(databaseUrl);
      let barrierHeld = false;
      let firstRun;

      try {
        await setupClient.query(`
          CREATE FUNCTION public.block_migration_ddl()
          RETURNS event_trigger
          LANGUAGE plpgsql
          AS $$
          BEGIN
            PERFORM pg_advisory_lock(${DDL_BARRIER_LOCK_VALUE});
          END;
          $$;
          CREATE EVENT TRIGGER block_migration_ddl
          ON ddl_command_start
          EXECUTE FUNCTION public.block_migration_ddl();
        `);
        await setupClient.query("SELECT pg_advisory_lock($1::bigint)", [
          String(DDL_BARRIER_LOCK_VALUE),
        ]);
        barrierHeld = true;

        firstRun = runDatabaseMigrations({
          databaseUrl,
          direction: "up",
        });

        await waitForMigrationLock(databaseUrl);
        const secondResult = await Promise.allSettled([
          runDatabaseMigrations({
            databaseUrl,
            direction: "up",
          }),
        ]);

        assert.equal(secondResult[0].status, "rejected");
        assert.equal(
          secondResult[0].reason instanceof DatabaseMigrationError,
          true,
        );
        assert.doesNotMatch(
          secondResult[0].reason.message,
          /postgres(?:ql)?:\/\//iu,
        );

        await setupClient.query("SELECT pg_advisory_unlock($1::bigint)", [
          String(DDL_BARRIER_LOCK_VALUE),
        ]);
        barrierHeld = false;

        assert.deepEqual(await firstRun, {
          applied: [DATABASE_MIGRATION_HEAD],
          current: DATABASE_MIGRATION_HEAD,
          direction: "up",
        });
      } finally {
        if (barrierHeld) {
          await setupClient.query("SELECT pg_advisory_unlock($1::bigint)", [
            String(DDL_BARRIER_LOCK_VALUE),
          ]);
        }

        await firstRun?.catch(() => undefined);
        await setupClient.query(
          "DROP EVENT TRIGGER IF EXISTS block_migration_ddl",
        );
        await setupClient.query(
          "DROP FUNCTION IF EXISTS public.block_migration_ddl()",
        );
        await setupClient.end();
      }
    });
  },
);

test(
  "invalid DDL rolls back schema changes and the migration ledger",
  { timeout: 180_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      const migrationDirectory = await mkdtemp(
        path.join(tmpdir(), "dnd-ai-invalid-migration-"),
      );
      const client = await connect(databaseUrl);

      try {
        await writeFile(
          path.join(migrationDirectory, "000001_failure_probe.js"),
          [
            "export function up(pgm) {",
            '  pgm.createSchema("failure_probe");',
            '  pgm.createTable({ schema: "failure_probe", name: "probe" }, { id: "serial" });',
            '  pgm.sql("THIS IS NOT VALID POSTGRESQL");',
            "}",
            "",
          ].join("\n"),
          "utf8",
        );

        await assert.rejects(
          nodePgMigrateRunner({
            advisoryLockMode: "fail",
            checkOrder: true,
            createMigrationsSchema: true,
            dbClient: client,
            decamelize: false,
            dir: migrationDirectory,
            direction: "up",
            lockValue: DATABASE_MIGRATION_LOCK_VALUE,
            logger: silentLogger,
            migrationsSchema: "infra",
            migrationsTable: "schema_migrations",
            noLock: false,
            schema: "public",
            singleTransaction: true,
            verbose: false,
          }),
        );

        const state = await client.query(`
          SELECT
            to_regnamespace('failure_probe') IS NOT NULL AS schema_exists,
            to_regclass('failure_probe.probe') IS NOT NULL AS table_exists,
            to_regclass('infra.schema_migrations') IS NOT NULL AS ledger_exists
        `);
        assert.deepEqual(state.rows[0], {
          ledger_exists: true,
          schema_exists: false,
          table_exists: false,
        });
        const ledger = await client.query(
          "SELECT count(*)::integer AS count FROM infra.schema_migrations",
        );
        assert.equal(ledger.rows[0].count, 0);

        const lock = await client.query(
          "SELECT pg_try_advisory_lock($1::bigint) AS acquired",
          [String(DATABASE_MIGRATION_LOCK_VALUE)],
        );
        assert.equal(lock.rows[0].acquired, true);
        await client.query("SELECT pg_advisory_unlock($1::bigint)", [
          String(DATABASE_MIGRATION_LOCK_VALUE),
        ]);
      } finally {
        await client.end();
        await rm(migrationDirectory, { force: true, recursive: true });
      }
    });
  },
);
