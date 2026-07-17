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

test("QA-002:playwright-config-owns-a-single-local-standalone-server", async () => {
  const config = await readFile(
    path.join(repositoryRoot, "tests/e2e/playwright.config.mjs"),
    "utf8",
  );

  assert.match(config, /127\.0\.0\.1/u);
  assert.match(config, /node tests\/e2e\/start-web-server\.mjs/u);
  assert.match(config, /apps\/web\/\.next\/standalone\/apps\/web\/server\.js/u);
  assert.match(config, /reuseExistingServer:\s*false/u);
  assert.match(config, /retries:\s*0/u);
  assert.match(config, /workers:\s*1/u);
  assert.match(config, /trace:\s*"off"/u);
  assert.match(config, /video:\s*"off"/u);
  assert.match(config, /PLAYWRIGHT_JUNIT_OUTPUT_FILE/u);
});

test("QA-002:browser-server-copies-next-static-assets-before-startup", async () => {
  const source = await readFile(
    path.join(repositoryRoot, "tests/e2e/start-web-server.mjs"),
    "utf8",
  );

  assert.match(
    source,
    /apps["'],\s*["']web["'],\s*["']\.next["'],\s*["']static/u,
  );
  assert.match(
    source,
    /standalone["'],\s*["']apps["'],\s*["']web["'],\s*["']\.next["'],\s*["']static/u,
  );
  assert.match(source, /await cp\(/u);
  assert.match(source, /await import\(/u);
});

test("QA-002:game-shell-browser-matrix-covers-mobile-touch-and-desktop", async () => {
  const [fixture, specification] = await Promise.all([
    readFile(
      path.join(repositoryRoot, "tests/e2e/browser-fixture.mjs"),
      "utf8",
    ),
    readFile(
      path.join(repositoryRoot, "tests/e2e/game-shell.spec.mjs"),
      "utf8",
    ),
  ]);
  const source = `${fixture}\n${specification}`;

  assert.match(source, /width:\s*320/u);
  assert.match(source, /width:\s*390/u);
  assert.match(source, /width:\s*1440/u);
  assert.match(source, /hasTouch:\s*true/u);
  assert.match(source, /touchscreen\.tap/u);
  assert.match(source, /scrollWidth/u);
  assert.match(source, /target size/u);
  assert.match(source, /focus restore/u);
});
