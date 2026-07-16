import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import { parse as parseYaml } from "yaml";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

async function readJson(relativePath) {
  return JSON.parse(
    await readFile(path.join(repositoryRoot, relativePath), "utf8"),
  );
}

test("identity uses only the approved exact-pinned runtime dependencies", async () => {
  const [api, worker, workspaceText] = await Promise.all([
    readJson("apps/api/package.json"),
    readJson("apps/worker/package.json"),
    readFile(path.join(repositoryRoot, "pnpm-workspace.yaml"), "utf8"),
  ]);
  const workspace = parseYaml(workspaceText);

  assert.equal(api.dependencies.argon2, "0.44.0");
  assert.equal(worker.dependencies.nodemailer, "9.0.3");
  assert.equal(worker.devDependencies["@types/nodemailer"], "8.0.1");
  assert.equal(workspace.allowBuilds.argon2, true);

  const dependencyNames = Object.keys({
    ...api.dependencies,
    ...api.devDependencies,
    ...worker.dependencies,
    ...worker.devDependencies,
  });
  assert.equal(
    dependencyNames.some((name) =>
      /clerk|auth0|descope|passport|next-auth|better-auth|bcrypt|scrypt|rate-limit/iu.test(
        name,
      ),
    ),
    false,
  );
});
