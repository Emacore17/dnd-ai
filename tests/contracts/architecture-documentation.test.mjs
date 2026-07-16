import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

async function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

async function workspacePackageNames() {
  const manifestPaths = [];
  for (const directory of ["apps", "packages"]) {
    const entries = await readdir(path.join(repositoryRoot, directory), {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        manifestPaths.push(path.join(directory, entry.name, "package.json"));
      }
    }
  }

  const manifests = await Promise.all(
    manifestPaths
      .sort()
      .map(async (manifestPath) => JSON.parse(await read(manifestPath))),
  );
  return manifests.map(({ name }) => name).sort();
}

test("architecture overview represents every tracked workspace", async () => {
  const overview = await read("docs/architecture/SYSTEM_OVERVIEW.md");

  for (const packageName of await workspacePackageNames()) {
    assert.match(
      overview,
      new RegExp("`" + escapeRegExp(packageName) + "`", "u"),
    );
  }

  assert.match(overview, /\*\*Implementato\*\*/u);
  assert.match(overview, /\*\*Pianificato\*\*/u);
  assert.match(overview, /- \*\*BullMQ:\*\* Pianificato/u);
  assert.match(overview, /- \*\*Redis locale:\*\* Pianificato/u);
  assert.match(overview, /- \*\*API di dominio:\*\* Pianificata/u);
  assert.match(overview, /- \*\*Staging:\*\* non disponibile/u);
});
