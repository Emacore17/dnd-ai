import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import { DEFAULT_BUILD_ROOTS } from "../../scripts/lib/build-artifact.mjs";
import { WORKSPACE_POLICY } from "../../scripts/lib/workspace-boundaries.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

async function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

function parseExample(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        assert.notEqual(separator, -1, `invalid example line: ${line}`);
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

test("service-specific local templates expose only their own configuration surface", async () => {
  const api = parseExample(await read("apps/api/.env.example"));
  const worker = parseExample(await read("apps/worker/.env.example"));
  const web = parseExample(await read("apps/web/.env.example"));
  const migration = parseExample(
    await read("packages/persistence/.env.example"),
  );

  assert.deepEqual(Object.keys(api).sort(), [
    "API_AUTH_BFF_ASSERTION_KEY_BASE64",
    "API_AUTH_CHALLENGE_HMAC_KEY_BASE64",
    "API_AUTH_CHALLENGE_KEY_VERSION",
    "API_AUTH_PASSWORD_PEPPER_BASE64",
    "API_AUTH_PASSWORD_PEPPER_VERSION",
    "API_AUTH_SESSION_HMAC_KEY_BASE64",
    "API_AUTH_SESSION_KEY_VERSION",
    "API_AUTH_SUBJECT_HASH_KEY_BASE64",
    "API_DATABASE_URL",
    "API_HOST",
    "API_PORT",
    "API_PUBLIC_ORIGIN",
    "API_REDIS_URL",
    "API_SENTRY_DSN",
    "APP_ENV",
  ]);
  assert.deepEqual(Object.keys(worker).sort(), [
    "APP_ENV",
    "WORKER_AUTH_CHALLENGE_HMAC_KEY_BASE64",
    "WORKER_AUTH_CHALLENGE_KEY_VERSION",
    "WORKER_DATABASE_URL",
    "WORKER_EMAIL_DELIVERY_MODE",
    "WORKER_REDIS_URL",
    "WORKER_SENTRY_DSN",
    "WORKER_SMTP_FROM",
    "WORKER_SMTP_HOST",
    "WORKER_SMTP_PASSWORD",
    "WORKER_SMTP_PORT",
    "WORKER_SMTP_SECURE",
    "WORKER_SMTP_USERNAME",
  ]);
  assert.deepEqual(Object.keys(web), [
    "APP_ENV",
    "WEB_API_INTERNAL_ORIGIN",
    "WEB_AUTH_BFF_ASSERTION_KEY_BASE64",
    "NEXT_PUBLIC_SENTRY_DSN",
  ]);
  assert.deepEqual(Object.keys(migration).sort(), [
    "APP_ENV",
    "MIGRATION_DATABASE_URL",
  ]);

  for (const example of [api, worker, migration]) {
    assert.equal(example.APP_ENV, "local");
    assert.equal(
      Object.keys(example).some((key) => key.startsWith("NEXT_PUBLIC_")),
      false,
    );
  }
  assert.equal(web.APP_ENV, "local");

  assert.equal("API_SENTRY_DSN" in worker, false);
  assert.equal("WORKER_SENTRY_DSN" in api, false);
  assert.equal("NEXT_PUBLIC_SENTRY_DSN" in api, false);
  assert.equal("NEXT_PUBLIC_SENTRY_DSN" in worker, false);
  assert.equal(web.NEXT_PUBLIC_SENTRY_DSN, "");
  assert.equal(web.WEB_API_INTERNAL_ORIGIN, "http://127.0.0.1:3001");

  assert.equal(api.API_HOST, "127.0.0.1");
  assert.equal(api.API_PORT, "3001");
  assert.equal(api.API_PUBLIC_ORIGIN, "http://127.0.0.1:3000");
  assert.equal(worker.WORKER_EMAIL_DELIVERY_MODE, "fake");
  assert.deepEqual(
    [
      api.API_DATABASE_URL,
      api.API_REDIS_URL,
      worker.WORKER_DATABASE_URL,
      worker.WORKER_REDIS_URL,
    ],
    Array.from({ length: 4 }, () => "<set-in-local-env-file>"),
  );
  assert.equal(api.API_SENTRY_DSN, "");
  assert.equal(worker.WORKER_SENTRY_DSN, "");
  assert.equal(
    migration.MIGRATION_DATABASE_URL,
    "postgresql://dnd_migration_local:dnd_migration_local@127.0.0.1:55432/dnd_ai_local",
  );
});

test("config is a server-only leaf package allowed only at runtime composition roots", () => {
  assert.deepEqual(WORKSPACE_POLICY["@dnd-ai/config"], []);
  assert.equal(
    WORKSPACE_POLICY["@dnd-ai/api"].includes("@dnd-ai/config"),
    true,
  );
  assert.equal(
    WORKSPACE_POLICY["@dnd-ai/worker"].includes("@dnd-ai/config"),
    true,
  );

  for (const packageName of [
    "@dnd-ai/web",
    "@dnd-ai/contracts",
    "@dnd-ai/domain",
    "@dnd-ai/rules",
    "@dnd-ai/ai",
    "@dnd-ai/persistence",
  ]) {
    assert.equal(
      WORKSPACE_POLICY[packageName].includes("@dnd-ai/config"),
      false,
      packageName,
    );
  }
});

test("the deploy artifact includes compiled config but never environment files", async () => {
  assert.equal(
    DEFAULT_BUILD_ROOTS.some(
      ({ source, target }) =>
        source === "packages/config/dist" && target === "packages/config/dist",
    ),
    true,
  );

  const gitignore = await read(".gitignore");
  assert.match(gitignore, /^\.env$/mu);
  assert.match(gitignore, /^\.env\.\*$/mu);
  assert.match(gitignore, /^!\.env\.example$/mu);
});

test("pure config parsing does not read ambient process state", async () => {
  const implementation = await read("packages/config/src/runtime-config.ts");
  assert.doesNotMatch(implementation, /process\.env/u);

  const webManifest = JSON.parse(await read("apps/web/package.json"));
  assert.equal("@dnd-ai/config" in webManifest.dependencies, false);

  const webTemplate = parseExample(await read("apps/web/.env.example"));
  assert.deepEqual(Object.keys(webTemplate), [
    "APP_ENV",
    "WEB_API_INTERNAL_ORIGIN",
    "WEB_AUTH_BFF_ASSERTION_KEY_BASE64",
    "NEXT_PUBLIC_SENTRY_DSN",
  ]);
});

test("workspace typecheck builds dependency declarations on a clean checkout", async () => {
  const turbo = JSON.parse(await read("turbo.json"));
  assert.equal(turbo.tasks.typecheck.dependsOn.includes("^build"), true);
  assert.equal(turbo.tasks.typecheck.dependsOn.includes("^typecheck"), true);
});

test("the composed config check preserves the pinned package manager", async () => {
  const rootManifest = JSON.parse(await read("package.json"));

  assert.equal(
    rootManifest.scripts["config:check"],
    "corepack pnpm@11.13.0 config:check:api && " +
      "corepack pnpm@11.13.0 config:check:worker && " +
      "corepack pnpm@11.13.0 config:check:web && " +
      "corepack pnpm@11.13.0 config:check:migration",
  );
});
