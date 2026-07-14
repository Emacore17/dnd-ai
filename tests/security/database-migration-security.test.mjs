import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const migrationCliPath = path.join(
  repositoryRoot,
  "scripts",
  "run-database-migrations.mjs",
);
const sentinel = "migration-secret-must-not-be-reflected";

function runMigrationCli(arguments_, environment = {}) {
  const childEnvironment = { ...process.env };
  delete childEnvironment.APP_ENV;
  delete childEnvironment.MIGRATION_DATABASE_URL;

  return spawnSync(process.execPath, [migrationCliPath, ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...childEnvironment, ...environment },
    timeout: 10_000,
    windowsHide: true,
  });
}

function assertRedactedFailure(result, expectedStatus) {
  assert.equal(result.status, expectedStatus);
  assert.equal(result.signal, null);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^[A-Za-z][A-Za-z0-9 (),:_-]{0,200}\n$/u);
  assert.doesNotMatch(result.stderr, new RegExp(sentinel, "u"));
  assert.doesNotMatch(result.stderr, /postgres(?:ql)?:\/\//iu);
  assert.doesNotMatch(result.stderr, /password/iu);
}

test("missing migration configuration fails before database access with redacted output", () => {
  assertRedactedFailure(runMigrationCli(["up"]), 1);
});

test("staging and production rollback remain closed even with local confirmation", () => {
  for (const environment of ["staging", "production"]) {
    const result = runMigrationCli(["down", "--confirm-local-rollback"], {
      APP_ENV: environment,
      MIGRATION_DATABASE_URL: `postgresql://migration_user:${sentinel}@${environment}-db.internal:5432/dnd_ai?sslmode=require`,
    });

    assertRedactedFailure(result, 1);
  }
});

test("local rollback without the exact confirmation flag fails before connecting", () => {
  const result = runMigrationCli(["down"], {
    APP_ENV: "local",
    MIGRATION_DATABASE_URL: `postgresql://migration_user:${sentinel}@127.0.0.1:1/dnd_ai`,
  });

  assertRedactedFailure(result, 2);
});

test("unknown CLI input is not reflected to standard error", () => {
  assertRedactedFailure(runMigrationCli([sentinel]), 2);
});
