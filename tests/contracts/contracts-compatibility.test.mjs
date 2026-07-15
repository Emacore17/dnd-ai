import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  compareContractCompatibilityBaseline,
  readContractArtifactsAtCommit,
  resolveContractCompatibilityBase,
} from "../../scripts/lib/contract-compatibility-policy.mjs";

function git(repositoryRoot, arguments_) {
  const result = spawnSync("git", arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

test("compatibility baseline comes from an offline Git commit and freezes v1", async () => {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), "dnd-ai-contract-compatibility-"),
  );

  try {
    const manifestPath = path.join(
      repositoryRoot,
      "packages",
      "contracts",
      "generated",
      "v1",
      "manifest.json",
    );
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, '{"contractVersion":"1.0.0"}\n', "utf8");

    git(repositoryRoot, ["init", "--initial-branch=main"]);
    git(repositoryRoot, ["add", "."]);
    git(repositoryRoot, [
      "-c",
      "user.name=Contract Test",
      "-c",
      "user.email=contract-test@example.invalid",
      "commit",
      "-m",
      "publish v1",
    ]);
    const baselineCommit = git(repositoryRoot, ["rev-parse", "HEAD"]);
    const resolvedCommit = await resolveContractCompatibilityBase(
      repositoryRoot,
      baselineCommit,
    );
    const baselineFiles = await readContractArtifactsAtCommit(
      repositoryRoot,
      resolvedCommit,
    );

    assert.equal(resolvedCommit, baselineCommit);
    assert.deepEqual(
      compareContractCompatibilityBaseline(
        baselineFiles,
        new Map(baselineFiles),
      ),
      [],
    );
    assert.deepEqual(
      compareContractCompatibilityBaseline(
        baselineFiles,
        new Map([
          ...baselineFiles,
          ["v2/manifest.json", '{"contractVersion":"2.0.0"}\n'],
        ]),
      ),
      [],
    );
    assert.deepEqual(
      compareContractCompatibilityBaseline(
        baselineFiles,
        new Map([["v1/manifest.json", '{"contractVersion":"1.0.1"}\n']]),
      ),
      ["published artifact changed: v1/manifest.json"],
    );

    await assert.rejects(
      resolveContractCompatibilityBase(repositoryRoot, "f".repeat(40)),
      /baseline is unavailable/u,
    );
  } finally {
    await rm(repositoryRoot, { recursive: true, force: true });
  }
});
