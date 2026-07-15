import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const generatedRoot = path.join(
  repositoryRoot,
  "packages",
  "contracts",
  "generated",
);

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.posix.join(prefix, entry.name);
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath, relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files.sort();
}

test("the generated contract check is read-only and accepts the tracked snapshot", async () => {
  const beforeFiles = await listFiles(generatedRoot);
  const beforeContents = await Promise.all(
    beforeFiles.map((file) =>
      readFile(path.join(generatedRoot, ...file.split("/")), "utf8"),
    ),
  );
  const result = spawnSync(
    process.execPath,
    ["scripts/generate-contracts.mjs", "--check"],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /contract-artifacts: PASS/u);
  assert.deepEqual(await listFiles(generatedRoot), beforeFiles);
  assert.deepEqual(
    await Promise.all(
      beforeFiles.map((file) =>
        readFile(path.join(generatedRoot, ...file.split("/")), "utf8"),
      ),
    ),
    beforeContents,
  );
});

test("the contract generator rejects unknown modes", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/generate-contracts.mjs", "--unsafe"],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /usage:.*--write\|--check/u);
});
