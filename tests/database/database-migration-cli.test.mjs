import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import {
  DATABASE_CONTRACT_VERSION,
  DATABASE_MIGRATION_HEAD,
} from "../../packages/persistence/dist/index.js";
import { withPostgresTestContainer } from "../../scripts/lib/postgres-test-container.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const migrationCliPath = path.join(
  repositoryRoot,
  "scripts",
  "run-database-migrations.mjs",
);

function runMigrationCli(arguments_, databaseUrl) {
  return spawnSync(process.execPath, [migrationCliPath, ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      APP_ENV: "local",
      MIGRATION_DATABASE_URL: databaseUrl,
    },
    timeout: 30_000,
    windowsHide: true,
  });
}

function assertSuccessfulCommand(result, expectedOutput, databaseUrl) {
  const password = new URL(databaseUrl).password;

  assert.equal(result.status, 0);
  assert.equal(result.signal, null);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, expectedOutput);
  assert.doesNotMatch(result.stdout, new RegExp(password, "u"));
  assert.doesNotMatch(result.stdout, new RegExp(databaseUrl, "u"));
}

test(
  "migration CLI reports empty, up, current contract and explicit local rollback",
  { timeout: 180_000 },
  async () => {
    await withPostgresTestContainer(async ({ databaseUrl }) => {
      assertSuccessfulCommand(
        runMigrationCli(["status"], databaseUrl),
        "Database migration status: current=empty; contract=none; applied=0; pending=1\n",
        databaseUrl,
      );

      assertSuccessfulCommand(
        runMigrationCli(["up"], databaseUrl),
        `Database migration up complete: current=${DATABASE_MIGRATION_HEAD}; changed=1\n`,
        databaseUrl,
      );

      assertSuccessfulCommand(
        runMigrationCli(["status"], databaseUrl),
        `Database migration status: current=${DATABASE_MIGRATION_HEAD}; contract=${DATABASE_CONTRACT_VERSION}; applied=1; pending=0\n`,
        databaseUrl,
      );

      assertSuccessfulCommand(
        runMigrationCli(["down", "--confirm-local-rollback"], databaseUrl),
        "Database migration down complete: current=empty; changed=1\n",
        databaseUrl,
      );
    });
  },
);
