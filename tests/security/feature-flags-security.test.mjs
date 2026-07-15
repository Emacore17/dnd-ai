import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const featureFlagCliPath = path.join(
  repositoryRoot,
  "scripts",
  "manage-feature-flag.mjs",
);
const sentinel = "feature-flag-secret-must-not-be-reflected";

function runFeatureFlagCli(arguments_, environment = {}) {
  const childEnvironment = { ...process.env };
  delete childEnvironment.APP_ENV;
  delete childEnvironment.MIGRATION_DATABASE_URL;

  return spawnSync(process.execPath, [featureFlagCliPath, ...arguments_], {
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
  assert.match(result.stderr, /^[A-Za-z][A-Za-z0-9 (),:_./-]{0,240}\n$/u);
  assert.doesNotMatch(result.stderr, new RegExp(sentinel, "u"));
  assert.doesNotMatch(result.stderr, /postgres(?:ql)?:\/\//iu);
  assert.doesNotMatch(result.stderr, /password/iu);
}

test("missing feature flag configuration fails before database access", () => {
  assertRedactedFailure(runFeatureFlagCli(["status", "campaign.start"]), 1);
});

test("unknown feature flag CLI input is rejected without reflection", () => {
  assertRedactedFailure(
    runFeatureFlagCli(["status", sentinel], {
      APP_ENV: "local",
      MIGRATION_DATABASE_URL: `postgresql://operator:${sentinel}@127.0.0.1:1/dnd_ai`,
    }),
    2,
  );
});

test("set requires explicit action, actor, reason and idempotency key", () => {
  assertRedactedFailure(
    runFeatureFlagCli(["set", "campaign.start", "--enable"], {
      APP_ENV: "local",
      MIGRATION_DATABASE_URL: `postgresql://operator:${sentinel}@127.0.0.1:1/dnd_ai`,
    }),
    2,
  );
});

test("malformed database configuration is redacted", () => {
  assertRedactedFailure(
    runFeatureFlagCli(["status", "campaign.start"], {
      APP_ENV: "local",
      MIGRATION_DATABASE_URL: sentinel,
    }),
    1,
  );
});
