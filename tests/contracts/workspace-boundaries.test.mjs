import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import {
  discoverWorkspace,
  validateWorkspaceBoundaries
} from "../../scripts/lib/workspace-boundaries.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

test("the current workspace satisfies every package boundary", async () => {
  const workspace = await discoverWorkspace(repositoryRoot);

  assert.deepEqual(validateWorkspaceBoundaries(workspace), []);
});

test("a domain dependency on persistence fails closed", () => {
  const fixtureRoot = path.join(
    repositoryRoot,
    "tests",
    "fixtures",
    "boundaries",
    "forbidden"
  );
  const checkerPath = path.join(repositoryRoot, "scripts", "check-boundaries.mjs");
  const result = spawnSync(
    process.execPath,
    [checkerPath, "--root", fixtureRoot],
    { encoding: "utf8" }
  );

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /forbidden-dependency: @dnd-ai\/domain -> @dnd-ai\/persistence/
  );
});
