import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import { VERCEL_DEPLOY_REQUIRED_FILES } from "../../scripts/lib/vercel-deploy-dry-run.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const checkerPath = path.join(
  repositoryRoot,
  "scripts",
  "check-vercel-deploy-dry-run.mjs",
);
const sentinel = "dry-run-output-must-not-reflect-this-value";

function createManifest() {
  const files = VERCEL_DEPLOY_REQUIRED_FILES.map((filePath) => ({
    path: filePath,
    size: 1,
    mode: 33_206,
    sha: "a".repeat(40),
  }));
  return {
    framework: { name: "Next.js", slug: "nextjs" },
    basePath: repositoryRoot,
    fileCount: files.length,
    totalSize: files.length,
    ignoredCount: 0,
    ignored: [],
    directories: [],
    largestFiles: files.slice(0, 10),
    files,
  };
}

function runChecker({ args = [], input = "" } = {}) {
  return spawnSync(process.execPath, [checkerPath, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    input,
  });
}

test("the dry-run checker accepts a valid manifest with static output", () => {
  const result = runChecker({ input: JSON.stringify(createManifest()) });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "vercel-deploy-dry-run: PASS\n");
  assert.equal(result.stderr, "");
});

test("invalid and unsafe input fails without reflecting source content", () => {
  const malformed = runChecker({ input: `{${sentinel}` });
  assert.equal(malformed.status, 1);
  assert.equal(malformed.stdout, "");
  assert.equal(malformed.stderr, "vercel-deploy-dry-run: invalid-json\n");
  assert.doesNotMatch(malformed.stderr, new RegExp(sentinel));

  const unsafeManifest = createManifest();
  unsafeManifest.files.push({
    path: `.turbo/${sentinel}.tar.zst`,
    size: 1,
    mode: 33_206,
    sha: "a".repeat(40),
  });
  unsafeManifest.fileCount += 1;
  unsafeManifest.totalSize += 1;
  const unsafe = runChecker({ input: JSON.stringify(unsafeManifest) });
  assert.equal(unsafe.status, 1);
  assert.equal(unsafe.stdout, "");
  assert.match(unsafe.stderr, /^vercel-deploy-dry-run: FAIL\n/);
  assert.doesNotMatch(unsafe.stderr, new RegExp(sentinel));
});

test("arguments and oversized stdin fail with bounded static errors", () => {
  const invalidArgument = runChecker({
    args: [sentinel],
    input: JSON.stringify(createManifest()),
  });
  assert.equal(invalidArgument.status, 1);
  assert.equal(
    invalidArgument.stderr,
    "vercel-deploy-dry-run: invalid-arguments\n",
  );
  assert.doesNotMatch(invalidArgument.stderr, new RegExp(sentinel));

  const oversized = runChecker({ input: "x".repeat(8 * 1024 * 1024 + 1) });
  assert.equal(oversized.status, 1);
  assert.equal(oversized.stderr, "vercel-deploy-dry-run: input-too-large\n");
});
