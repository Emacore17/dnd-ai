import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import {
  validateDeploymentManifest,
  validateManualDeploymentPolicy,
} from "../../scripts/lib/deployment-foundation.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

async function readManifest() {
  return JSON.parse(
    await readFile(
      path.join(repositoryRoot, "infra", "deployment", "vercel-staging.json"),
      "utf8",
    ),
  );
}

test("manual Preview deployment creation is disabled in the current desired state", async () => {
  const manifest = await readManifest();

  assert.deepEqual(validateDeploymentManifest(manifest), []);
  assert.deepEqual(validateManualDeploymentPolicy(manifest), []);
  assert.deepEqual(
    validateManualDeploymentPolicy(manifest, { requireEnabled: true }),
    ["manual Preview deployment creation is disabled"],
  );
});

test("a reviewed Preview-only policy can open the manual gate while Git stays disabled", async () => {
  const manifest = await readManifest();
  manifest.source.manualDeployment.enabled = true;
  manifest.provider.project.id = "prj_1234567890";
  manifest.provider.project.scopeSlug = "emacore17s-projects";
  manifest.provider.project.stagingOrigin =
    "https://dnd-ai-web-git-main-emacore17s-projects.vercel.app";
  manifest.source.installationId = 41079282;

  assert.equal(manifest.source.autoDeploy, false);
  assert.deepEqual(
    validateManualDeploymentPolicy(manifest, { requireEnabled: true }),
    [],
  );
  assert.deepEqual(
    validateDeploymentManifest(manifest, { requireLinked: true }),
    [],
  );
});

test("missing, Production, or simultaneous activation policies fail closed", async () => {
  const manifest = await readManifest();

  const missingPolicy = globalThis.structuredClone(manifest);
  delete missingPolicy.source.manualDeployment;
  assert.ok(
    validateDeploymentManifest(missingPolicy).some((error) =>
      error.includes("source.manualDeployment"),
    ),
  );

  const productionPolicy = globalThis.structuredClone(manifest);
  productionPolicy.source.manualDeployment.target = "production";
  assert.ok(
    validateDeploymentManifest(productionPolicy).some((error) =>
      error.includes('source.manualDeployment.target must be "preview"'),
    ),
  );

  const simultaneousActivation = globalThis.structuredClone(manifest);
  simultaneousActivation.source.manualDeployment.enabled = true;
  simultaneousActivation.source.autoDeploy = true;
  assert.ok(
    validateDeploymentManifest(simultaneousActivation).some((error) =>
      error.includes("source.autoDeploy to remain false"),
    ),
  );

  const enabledButUnlinked = globalThis.structuredClone(manifest);
  enabledButUnlinked.source.manualDeployment.enabled = true;
  assert.ok(
    validateDeploymentManifest(enabledButUnlinked, {
      requireLinked: true,
    }).some((error) => error.includes("project.id is required")),
    "a manual gate must not open without exact provider bindings",
  );
});
