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
