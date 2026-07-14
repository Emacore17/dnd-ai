import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const gatePath = path.join(
  repositoryRoot,
  "scripts",
  "assert-vercel-preview-bootstrap-enabled.mjs",
);
const sentinel = "bootstrap-gate-must-not-reflect-this-value";

function runGate(args = []) {
  return spawnSync(process.execPath, [gatePath, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, BOOTSTRAP_GATE_SENTINEL: sentinel },
  });
}

test("the checked-in policy blocks manual deployment creation with static output", () => {
  const result = runGate();

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "vercel-preview-bootstrap: disabled\n");
  assert.doesNotMatch(result.stderr, new RegExp(sentinel));
});

test("unexpected arguments fail without reflecting their content", () => {
  const result = runGate([sentinel]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "vercel-preview-bootstrap: invalid-arguments\n");
  assert.doesNotMatch(result.stderr, new RegExp(sentinel));
});
