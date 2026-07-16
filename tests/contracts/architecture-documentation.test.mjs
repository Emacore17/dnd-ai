import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

async function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function stringConstant(source, name) {
  const match = source.match(
    new RegExp(`export const ${escapeRegExp(name)}\\s*=\\s*"([^"]+)"`, "u"),
  );
  assert.ok(match, `missing constant ${name}`);
  return match[1];
}

async function workspacePackageNames() {
  const manifestPaths = [];
  for (const directory of ["apps", "packages"]) {
    const entries = await readdir(path.join(repositoryRoot, directory), {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        manifestPaths.push(path.join(directory, entry.name, "package.json"));
      }
    }
  }

  const manifests = await Promise.all(
    manifestPaths
      .sort()
      .map(async (manifestPath) => JSON.parse(await read(manifestPath))),
  );
  return manifests.map(({ name }) => name).sort();
}

test("architecture overview represents every tracked workspace", async () => {
  const overview = await read("docs/architecture/SYSTEM_OVERVIEW.md");

  for (const packageName of await workspacePackageNames()) {
    assert.match(
      overview,
      new RegExp("`" + escapeRegExp(packageName) + "`", "u"),
    );
  }

  assert.match(overview, /\*\*Implementato\*\*/u);
  assert.match(overview, /\*\*Pianificato\*\*/u);
  assert.match(overview, /- \*\*BullMQ:\*\* Pianificato/u);
  assert.match(overview, /- \*\*Redis locale:\*\* Pianificato/u);
  assert.match(overview, /- \*\*API di dominio:\*\* Pianificata/u);
  assert.match(overview, /- \*\*Staging:\*\* non disponibile/u);
});

test("data model follows the persistence migration head", async () => {
  const [dataModel, migrationSource] = await Promise.all([
    read("docs/data/DATA_MODEL.md"),
    read("packages/persistence/src/migration-manifest.ts"),
  ]);
  const head = stringConstant(
    migrationSource,
    "DATABASE_IDENTITY_SIGNUP_MIGRATION_NAME",
  );
  const contract = stringConstant(
    migrationSource,
    "DATABASE_IDENTITY_SIGNUP_CONTRACT_VERSION",
  );

  assert.match(dataModel, new RegExp("`" + escapeRegExp(head) + "`", "u"));
  assert.match(dataModel, new RegExp("`" + escapeRegExp(contract) + "`", "u"));
  assert.match(dataModel, /\*\*Implementato\*\*/u);
  assert.match(dataModel, /\*\*Pianificato\*\*/u);
  for (const tableName of [
    "infra.migration_contracts",
    "app.feature_flags",
    "app.feature_flag_events",
    "app.users",
    "app.email_verification_challenges",
    "app.user_sessions",
    "app.identity_email_outbox",
  ]) {
    assert.match(
      dataModel,
      new RegExp("`" + escapeRegExp(tableName) + "`", "u"),
    );
  }
});

test("local development guide exposes only existing commands and readiness", async () => {
  const [guide, rootManifestSource] = await Promise.all([
    read("docs/operations/LOCAL_DEVELOPMENT.md"),
    read("package.json"),
  ]);
  const scripts = JSON.parse(rootManifestSource).scripts ?? {};
  const requiredScripts = [
    "db:local:up",
    "config:check",
    "config:check:migration",
    "db:migrate:local",
    "db:migrate:status:local",
    "build",
    "test:integration",
    "db:local:down",
  ];

  for (const scriptName of requiredScripts) {
    assert.equal(typeof scripts[scriptName], "string");
    assert.match(
      guide,
      new RegExp(`pnpm@11\\.13\\.0 ${escapeRegExp(scriptName)}(?:\\s|$)`, "mu"),
    );
  }

  assert.match(guide, /\*\*Implementato\*\*/u);
  assert.match(guide, /\*\*Pianificato\*\*/u);
  assert.match(guide, /`web-health-v1`/u);
  assert.match(guide, /API non espone ancora un endpoint health/u);
  assert.match(guide, /worker non è ancora un daemon BullMQ/u);
  assert.match(guide, /staging non è disponibile/u);
});
