import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const guardPath = path.join(
  repositoryRoot,
  "apps",
  "web",
  "scripts",
  "assert-vercel-preview-build.mjs",
);
const sentinel = "guard-output-must-not-contain-this-value";
const managedKeys = ["VERCEL", "VERCEL_ENV", "VERCEL_TARGET_ENV"];

function runGuard({ args = [], environment = {} } = {}) {
  const childEnvironment = {
    ...process.env,
    DND_AI_GUARD_TEST_SENTINEL: sentinel,
  };
  for (const key of managedKeys) {
    delete childEnvironment[key];
  }
  Object.assign(childEnvironment, environment);

  return spawnSync(process.execPath, [guardPath, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: childEnvironment,
  });
}

function assertRedacted(result) {
  assert.doesNotMatch(result.stdout, new RegExp(sentinel));
  assert.doesNotMatch(result.stderr, new RegExp(sentinel));
}

test("the guard allows explicit local and strict Preview execution without output", () => {
  const local = runGuard({ args: ["--allow-local"] });
  assert.equal(local.status, 0);
  assert.equal(local.stdout, "");
  assert.equal(local.stderr, "");

  const preview = runGuard({
    environment: {
      VERCEL: "1",
      VERCEL_ENV: "preview",
      VERCEL_TARGET_ENV: "preview",
    },
  });
  assert.equal(preview.status, 0);
  assert.equal(preview.stdout, "");
  assert.equal(preview.stderr, "");
});

test("the guard rejects Production and incomplete cloud metadata with static redacted errors", () => {
  for (const [name, result, errorCode] of [
    [
      "production",
      runGuard({
        environment: {
          VERCEL: "1",
          VERCEL_ENV: "production",
          VERCEL_TARGET_ENV: "production",
        },
      }),
      "target-not-preview",
    ],
    [
      "production with local fallback enabled",
      runGuard({
        args: ["--allow-local"],
        environment: {
          VERCEL: "1",
          VERCEL_ENV: "production",
          VERCEL_TARGET_ENV: "production",
        },
      }),
      "target-not-preview",
    ],
    ["missing metadata", runGuard(), "missing-vercel-metadata"],
    [
      "incomplete metadata",
      runGuard({ environment: { VERCEL: "1", VERCEL_ENV: "preview" } }),
      "invalid-vercel-metadata",
    ],
    [
      "untrusted target value",
      runGuard({
        environment: {
          VERCEL: "1",
          VERCEL_ENV: sentinel,
          VERCEL_TARGET_ENV: sentinel,
        },
      }),
      "target-not-preview",
    ],
  ]) {
    assert.equal(result.status, 1, name);
    assert.equal(result.stdout, "", name);
    assert.match(
      result.stderr,
      new RegExp(`^preview-build-guard: ${errorCode}\\n$`),
      name,
    );
    assertRedacted(result);
  }
});

test("unknown guard arguments fail without reflecting their values", () => {
  const result = runGuard({ args: ["--unexpected-sensitive-value"] });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "preview-build-guard: invalid-arguments\n");
  assert.doesNotMatch(result.stderr, /unexpected-sensitive-value/);
  assertRedacted(result);
});
