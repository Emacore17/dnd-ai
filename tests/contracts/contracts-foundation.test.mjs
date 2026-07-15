import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

async function readJson(relativePath) {
  return JSON.parse(
    await readFile(path.join(repositoryRoot, relativePath), "utf8"),
  );
}

test("the contracts package owns one exact Zod source and no codegen framework", async () => {
  const manifest = await readJson("packages/contracts/package.json");

  assert.equal(manifest.sideEffects, false);
  assert.deepEqual(manifest.dependencies, { zod: "4.4.3" });
  assert.equal(manifest.exports?.["."]?.types, "./dist/index.d.ts");
  assert.equal(manifest.exports?.["."]?.import, "./dist/index.js");

  const dependencyNames = Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  });

  assert.equal(
    dependencyNames.some((name) =>
      /zod-to|zod.*openapi|openapi.*zod/u.test(name),
    ),
    false,
  );
});

test("standalone contract commands build the package and check generated drift", async () => {
  const manifest = await readJson("package.json");

  assert.equal(manifest.devDependencies.ajv, "8.20.0");
  assert.equal(manifest.devDependencies["ajv-formats"], "3.0.1");
  assert.equal(
    manifest.scripts["contracts:generate"],
    "turbo run build --filter=@dnd-ai/contracts && node scripts/generate-contracts.mjs --write",
  );
  assert.equal(
    manifest.scripts["contracts:check"],
    "turbo run build --filter=@dnd-ai/contracts && node scripts/generate-contracts.mjs --check",
  );
  assert.equal(
    manifest.scripts["test:contract"],
    "turbo run build --filter=@dnd-ai/contracts && node --test tests/contracts/*.test.mjs",
  );
  assert.match(
    manifest.scripts.verify,
    /turbo run build && node scripts\/generate-contracts\.mjs --check &&/u,
  );
  assert.doesNotMatch(manifest.scripts.verify, /&& pnpm contracts:check &&/u);
});

test("canonical generated contracts are owned by the generator, not Prettier", async () => {
  const prettierIgnore = await readFile(
    path.join(repositoryRoot, ".prettierignore"),
    "utf8",
  );

  assert.ok(
    prettierIgnore.split(/\r?\n/u).includes("packages/contracts/generated/"),
  );
});
