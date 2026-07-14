import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

import {
  DatabaseMigrationPolicyError,
  parseDatabaseMigrationArguments,
  validateDatabaseMigrationRequest,
} from "../../scripts/lib/database-migration-policy.mjs";

const environments = Object.freeze(["local", "staging", "production"]);
const { Client } = pg;

test("up and status are valid in every declared environment", () => {
  for (const environment of environments) {
    for (const direction of ["up", "status"]) {
      const request = validateDatabaseMigrationRequest({
        confirmedLocalRollback: false,
        direction,
        environment,
      });

      assert.deepEqual(request, {
        allowDestructiveRollback: false,
        direction,
      });
      assert.equal(Object.isFrozen(request), true);
    }
  }
});

test("down requires both local environment and explicit local confirmation", () => {
  for (const databaseUrl of [
    "postgresql://migration@127.0.0.1:55432/dnd_ai_local",
    "postgresql://migration@localhost:55432/dnd_ai_test",
    "postgresql://migration@[::1]:55432/dnd_ai_test",
  ]) {
    const request = validateDatabaseMigrationRequest({
      confirmedLocalRollback: true,
      databaseUrl,
      direction: "down",
      environment: "local",
    });

    assert.deepEqual(request, {
      allowDestructiveRollback: true,
      direction: "down",
    });
  }

  for (const candidate of [
    {
      confirmedLocalRollback: false,
      databaseUrl: "postgresql://migration@127.0.0.1:55432/dnd_ai_local",
      direction: "down",
      environment: "local",
    },
    {
      confirmedLocalRollback: true,
      databaseUrl: "postgresql://migration@127.0.0.1:55432/dnd_ai_local",
      direction: "down",
      environment: "staging",
    },
    {
      confirmedLocalRollback: true,
      databaseUrl: "postgresql://migration@127.0.0.1:55432/dnd_ai_local",
      direction: "down",
      environment: "production",
    },
    {
      confirmedLocalRollback: true,
      direction: "down",
      environment: "local",
    },
    {
      confirmedLocalRollback: true,
      databaseUrl: "postgresql://migration@database.internal:5432/dnd_ai_local",
      direction: "down",
      environment: "local",
    },
    {
      confirmedLocalRollback: true,
      databaseUrl: "postgresql://migration@127.0.0.1:55432/unrelated",
      direction: "down",
      environment: "local",
    },
    {
      confirmedLocalRollback: true,
      databaseUrl: "mysql://migration@127.0.0.1:3306/dnd_ai_local",
      direction: "down",
      environment: "local",
    },
  ]) {
    assert.throws(
      () => validateDatabaseMigrationRequest(candidate),
      DatabaseMigrationPolicyError,
    );
  }
});

test("down rejects connection-string routing overrides accepted by pg", () => {
  const databaseUrl =
    "postgresql://migration@127.0.0.1:55432/dnd_ai_local?host=production.internal&port=5432";
  const client = new Client({ connectionString: databaseUrl });

  assert.equal(client.connectionParameters.host, "production.internal");
  assert.equal(client.connectionParameters.port, 5432);
  assert.throws(
    () =>
      validateDatabaseMigrationRequest({
        confirmedLocalRollback: true,
        databaseUrl,
        direction: "down",
        environment: "local",
      }),
    DatabaseMigrationPolicyError,
  );
});

test("migration arguments expose one unambiguous command contract", () => {
  assert.deepEqual(parseDatabaseMigrationArguments(["up"]), {
    confirmedLocalRollback: false,
    direction: "up",
  });
  assert.deepEqual(parseDatabaseMigrationArguments(["status"]), {
    confirmedLocalRollback: false,
    direction: "status",
  });
  assert.deepEqual(
    parseDatabaseMigrationArguments(["down", "--confirm-local-rollback"]),
    {
      confirmedLocalRollback: true,
      direction: "down",
    },
  );
});

test("unknown, duplicated or misplaced migration arguments fail without reflection", () => {
  const sentinel = "migration-policy-must-not-reflect-this-value";

  for (const arguments_ of [
    [],
    [sentinel],
    ["up", sentinel],
    ["up", "--confirm-local-rollback"],
    ["down"],
    ["down", "--confirm-local-rollback", "--confirm-local-rollback"],
    ["status", "--confirm-local-rollback"],
  ]) {
    assert.throws(
      () => parseDatabaseMigrationArguments(arguments_),
      (error) => {
        assert.equal(error instanceof DatabaseMigrationPolicyError, true);
        assert.doesNotMatch(error.message, new RegExp(sentinel, "u"));
        return true;
      },
    );
  }
});
