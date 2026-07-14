import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import { parse } from "yaml";

import { POSTGRES_TEST_IMAGE } from "../../scripts/lib/postgres-test-container.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const expectedPostgresImage =
  "pgvector/pgvector:0.8.2-pg17-trixie@sha256:5c97c57367a485a8e99389548db67d441ab1a878f5492c3df04989f34ecf3c75";

async function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

test("database migration commands use the versioned composition root", async () => {
  const manifest = JSON.parse(await read("package.json"));
  const scripts = manifest.scripts ?? {};

  assert.match(scripts["db:local:up"], /up -d --wait --wait-timeout 30$/u);
  assert.match(
    scripts["db:migrate"],
    /node scripts\/run-database-migrations\.mjs up$/u,
  );
  assert.match(
    scripts["db:migrate:status"],
    /node scripts\/run-database-migrations\.mjs status$/u,
  );
  assert.match(
    scripts["db:rollback:local"],
    /node --env-file=packages\/persistence\/\.env\.local scripts\/run-database-migrations\.mjs down --confirm-local-rollback$/u,
  );
  assert.match(
    scripts["db:migrate:test"],
    /node --test --test-concurrency=1 tests\/database\/\*\.test\.mjs$/u,
  );
  assert.match(
    scripts.verify,
    /node --test --test-concurrency=1 tests\/database\/\*\.test\.mjs/u,
  );

  const [
    compositionRoot,
    policy,
    migration,
    persistenceManifestSource,
    runner,
  ] = await Promise.all([
    read("scripts/run-database-migrations.mjs"),
    read("scripts/lib/database-migration-policy.mjs"),
    read("packages/persistence/src/migrations/000001_postgresql_foundation.ts"),
    read("packages/persistence/src/migration-manifest.ts"),
    read("packages/persistence/src/migration-runner.ts"),
  ]);

  assert.match(compositionRoot, /parseMigrationRuntimeConfig/u);
  assert.match(compositionRoot, /runDatabaseMigrations/u);
  assert.match(compositionRoot, /getDatabaseMigrationStatus/u);
  assert.match(policy, /--confirm-local-rollback/u);
  assert.match(migration, /createExtension\("vector"\)/u);
  assert.match(migration, /createSchema\("app"\)/u);
  assert.match(persistenceManifestSource, /000001_postgresql_foundation/u);
  assert.match(persistenceManifestSource, /database-baseline-v1/u);
  assert.match(runner, /const MIGRATIONS_SCHEMA = "infra"/u);
  assert.match(runner, /const MIGRATIONS_TABLE = "schema_migrations"/u);
  assert.match(runner, /validateMigrationDirectory/u);
  assert.match(runner, /entry\.isSymbolicLink\(\)/u);

  const normalizedMigrationSource = migration.replace(/\r\n?/gu, "\n");
  const sourceChecksumMatch = persistenceManifestSource.match(
    /DATABASE_BASELINE_MIGRATION_SOURCE_SHA256 =\s+"([0-9a-f]{64})"/u,
  );
  assert.ok(sourceChecksumMatch);
  assert.equal(
    createHash("sha256").update(normalizedMigrationSource).digest("hex"),
    sourceChecksumMatch[1],
  );
});

test("local and acceptance databases use the same immutable pgvector image", async () => {
  const compose = parse(await read("infra/local/postgres.compose.yml"));
  const postgres = compose.services?.postgres;

  assert.equal(POSTGRES_TEST_IMAGE, expectedPostgresImage);
  assert.equal(postgres?.image, expectedPostgresImage);
  assert.deepEqual(postgres?.ports, ["127.0.0.1:55432:5432"]);
  assert.equal(postgres?.environment?.POSTGRES_DB, "dnd_ai_local");
  assert.equal(postgres?.environment?.POSTGRES_USER, "dnd_migration_local");
  assert.ok(postgres?.healthcheck);
});

test("required CI executes the real PostgreSQL migration suite", async () => {
  const workflow = parse(await read(".github/workflows/ci.yml"));
  const testSteps = workflow.jobs?.tests?.steps ?? [];

  assert.equal(
    testSteps.some((step) => step.run === "pnpm db:migrate:test"),
    true,
  );
  assert.equal(workflow.jobs?.tests?.services, undefined);
  assert.equal(
    testSteps.some((step) => step["continue-on-error"] === true),
    false,
  );
});

test("the persistence package pins one PostgreSQL migration stack", async () => {
  const manifest = JSON.parse(await read("packages/persistence/package.json"));

  assert.equal(manifest.dependencies?.["node-pg-migrate"], "8.0.4");
  assert.equal(manifest.dependencies?.pg, "8.22.0");
  assert.equal(manifest.devDependencies?.["@types/pg"], "8.20.0");
  assert.equal("drizzle-orm" in (manifest.dependencies ?? {}), false);
  assert.equal("kysely" in (manifest.dependencies ?? {}), false);
  assert.equal("prisma" in (manifest.dependencies ?? {}), false);
});
