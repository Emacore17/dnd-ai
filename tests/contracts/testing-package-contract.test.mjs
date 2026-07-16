import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

test("QA-001:testing-root-export-stays-platform-neutral", async () => {
  const [manifestSource, compiledSource, testing] = await Promise.all([
    readFile(
      path.join(repositoryRoot, "packages", "testing", "package.json"),
      "utf8",
    ),
    readFile(
      path.join(repositoryRoot, "packages", "testing", "dist", "index.js"),
      "utf8",
    ),
    import("../../packages/testing/dist/index.js"),
  ]);
  const manifest = JSON.parse(manifestSource);

  assert.equal(manifest.sideEffects, false);
  assert.deepEqual(Object.keys(testing).sort(), [
    "createFakeClock",
    "createFixtureFactory",
    "createSeededRng",
    "createTestId",
  ]);
  assert.doesNotMatch(compiledSource, /(?:from\s+|import\()["']node:/u);
  assert.doesNotMatch(compiledSource, /process\.env|Date\.now|Math\.random/u);
});

test("QA-001:testing-node-subpath-is-explicit-and-node-only", async () => {
  const [manifestSource, nodeEntrySource, testingNode] = await Promise.all([
    readFile(
      path.join(repositoryRoot, "packages", "testing", "package.json"),
      "utf8",
    ),
    readFile(
      path.join(
        repositoryRoot,
        "packages",
        "testing",
        "dist",
        "node",
        "index.js",
      ),
      "utf8",
    ),
    import("../../packages/testing/dist/node/index.js"),
  ]);
  const manifest = JSON.parse(manifestSource);

  assert.deepEqual(manifest.exports["./node"], {
    types: "./dist/node/index.d.ts",
    import: "./dist/node/index.js",
  });
  assert.deepEqual(Object.keys(testingNode).sort(), [
    "POSTGRES_TEST_DATABASE",
    "POSTGRES_TEST_IMAGE",
    "POSTGRES_TEST_USERNAME",
    "REDIS_TEST_IMAGE",
    "createDockerContainerLifecycle",
    "startPostgresTestContainer",
    "startRedisTestContainer",
    "stopPostgresTestContainer",
    "stopRedisTestContainer",
    "withPostgresTestContainer",
    "withRedisTestContainer",
  ]);
  assert.match(nodeEntrySource, /\.\/docker-container\.js/u);
});
