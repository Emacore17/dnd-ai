import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { assertOwnedPathChain } from "../../scripts/lib/owned-path-policy.mjs";

test("owned path chain accepts missing descendants under a regular root", async () => {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), "dnd-ai-owned-path-safe-"),
  );

  try {
    await mkdir(path.join(repositoryRoot, "packages", "contracts"), {
      recursive: true,
    });

    await assert.doesNotReject(
      assertOwnedPathChain(
        repositoryRoot,
        path.join(repositoryRoot, "packages", "contracts", "generated"),
      ),
    );
  } finally {
    await rm(repositoryRoot, { recursive: true, force: true });
  }
});

test("owned path chain rejects a generated-root symlink or junction", async () => {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), "dnd-ai-owned-path-linked-"),
  );
  const externalRoot = await mkdtemp(
    path.join(os.tmpdir(), "dnd-ai-owned-path-target-"),
  );

  try {
    const contractsRoot = path.join(repositoryRoot, "packages", "contracts");
    const sentinelPath = path.join(externalRoot, "sentinel.txt");
    await writeFile(sentinelPath, "unchanged\n", "utf8");
    await mkdir(contractsRoot, { recursive: true });
    await symlink(
      externalRoot,
      path.join(contractsRoot, "generated"),
      process.platform === "win32" ? "junction" : "dir",
    );

    await assert.rejects(
      assertOwnedPathChain(
        repositoryRoot,
        path.join(contractsRoot, "generated"),
      ),
      /owned path contains a symbolic link/u,
    );
    assert.equal(await readFile(sentinelPath, "utf8"), "unchanged\n");
  } finally {
    await rm(repositoryRoot, { recursive: true, force: true });
    await rm(externalRoot, { recursive: true, force: true });
  }
});
