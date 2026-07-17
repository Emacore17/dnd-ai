import assert from "node:assert/strict";
import { glob, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import {
  TEST_LANES,
  resolveTestLane,
} from "../../scripts/lib/test-lane-policy.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

async function readManifest(relativePath) {
  return JSON.parse(
    await readFile(path.join(repositoryRoot, relativePath), "utf8"),
  );
}

test("QA-002:browser-dependencies-and-commands-are-root-owned", async () => {
  const rootManifest = await readManifest("package.json");

  assert.equal(rootManifest.devDependencies?.["@playwright/test"], "1.61.1");
  assert.equal(
    rootManifest.devDependencies?.["@axe-core/playwright"],
    "4.12.1",
  );
  assert.equal(
    rootManifest.scripts?.["test:e2e"],
    "node scripts/run-tests.mjs e2e",
  );
  assert.equal(
    rootManifest.scripts?.["test:e2e:update"],
    "node scripts/update-browser-snapshots.mjs",
  );
  assert.equal(
    rootManifest.scripts?.["test:e2e:install"],
    "playwright install chromium",
  );
  assert.equal(
    rootManifest.scripts?.["test:e2e:install:ci"],
    "playwright install --with-deps chromium",
  );

  for await (const manifestPath of glob("{apps,packages}/*/package.json", {
    cwd: repositoryRoot,
  })) {
    const manifest = await readManifest(manifestPath);
    const directDependencies = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
    };

    for (const packageName of [
      "@axe-core/playwright",
      "@playwright/test",
      "playwright",
      "playwright-core",
    ]) {
      assert.equal(
        packageName in directDependencies,
        false,
        `${manifestPath} must not own ${packageName}`,
      );
    }
  }
});

test("QA-002:e2e-lane-is-closed-bounded-and-browser-only", () => {
  assert.equal(TEST_LANES.e2e, resolveTestLane("e2e"));
  assert.deepEqual(resolveTestLane("e2e"), {
    buildFilters: ["@dnd-ai/web"],
    concurrency: 1,
    executor: "playwright",
    name: "e2e",
    ownerTaskIds: ["QA-002"],
    patterns: ["tests/e2e/*.spec.mjs"],
    timeoutMs: 300_000,
  });
  assert.equal(Object.isFrozen(resolveTestLane("e2e")), true);
});
