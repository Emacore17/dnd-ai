import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import {
  CHILD_ENV_ALLOWLIST,
  TEST_LANES,
  createChildEnvironment,
  discoverLaneFiles,
  resolveTestLane,
} from "../../scripts/lib/test-lane-policy.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

test("QA-001:test-lane-catalog-is-closed-and-bounded", () => {
  assert.deepEqual(Object.keys(TEST_LANES), [
    "unit",
    "integration",
    "database",
    "contract",
    "security",
  ]);
  assert.equal(resolveTestLane("database").concurrency, 1);
  assert.deepEqual(resolveTestLane("unit").ownerTaskIds, ["QA-001"]);
  assert.ok(resolveTestLane("unit").buildFilters.includes("@dnd-ai/domain"));
  assert.ok(resolveTestLane("unit").buildFilters.includes("@dnd-ai/api"));
  assert.ok(resolveTestLane("unit").buildFilters.includes("@dnd-ai/worker"));
  assert.ok(resolveTestLane("security").buildFilters.includes("@dnd-ai/api"));
  assert.ok(
    resolveTestLane("security").buildFilters.includes("@dnd-ai/worker"),
  );
  assert.equal(Object.isFrozen(TEST_LANES), true);
  assert.equal(Object.isFrozen(resolveTestLane("unit")), true);

  for (const invalidLane of ["", "all", "e2e", "../unit", "UNIT"]) {
    assert.throws(
      () => resolveTestLane(invalidLane),
      /test-runner: unknown-lane/u,
    );
  }
});

test("QA-001:test-lane-discovery-is-sorted-and-excludes-fixtures", async () => {
  const files = await discoverLaneFiles(
    repositoryRoot,
    resolveTestLane("unit"),
  );

  assert.ok(files.length > 0);
  assert.deepEqual(files, files.toSorted());
  assert.ok(files.every((filePath) => filePath.endsWith(".test.mjs")));
  assert.ok(files.every((filePath) => !filePath.includes("fixtures")));

  const emptyRoot = await mkdtemp(path.join(os.tmpdir(), "dnd-ai-lane-"));
  await mkdir(path.join(emptyRoot, "tests", "unit"), { recursive: true });
  await assert.rejects(
    discoverLaneFiles(emptyRoot, resolveTestLane("unit")),
    /test-runner: empty-lane/u,
  );
});

test("QA-001:child-environment-drops-application-values-and-secrets", () => {
  const source = {
    APP_SECRET: "must-not-pass",
    CI: "true",
    DATABASE_URL: "postgresql://user:password@example.invalid/database",
    LOCALAPPDATA: "C:\\safe-local-app-data",
    NODE_OPTIONS: "--inspect",
    PATH: "safe-path",
    PNPM_HOME: "C:\\safe-pnpm-home",
    REDIS_URL: "redis://user:password@example.invalid/0",
    TURBO_FORCE: "true",
  };

  assert.deepEqual(createChildEnvironment(source), {
    CI: "true",
    LOCALAPPDATA: "C:\\safe-local-app-data",
    PATH: "safe-path",
    PNPM_HOME: "C:\\safe-pnpm-home",
    TURBO_FORCE: "true",
  });
  assert.ok(CHILD_ENV_ALLOWLIST.includes("PNPM_HOME"));
  assert.ok(CHILD_ENV_ALLOWLIST.includes("LOCALAPPDATA"));
  assert.ok(CHILD_ENV_ALLOWLIST.includes("TURBO_FORCE"));
  assert.equal(Object.isFrozen(CHILD_ENV_ALLOWLIST), true);
});
