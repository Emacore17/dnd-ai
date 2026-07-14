import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

import {
  validateDeploymentManifest,
  validateManualDeploymentPolicy,
} from "./lib/deployment-foundation.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = path.join(
  repositoryRoot,
  "infra",
  "deployment",
  "vercel-staging.json",
);

function fail(reason) {
  process.stderr.write(`vercel-preview-bootstrap: ${reason}\n`);
  process.exitCode = 1;
}

if (process.argv.length !== 2) {
  fail("invalid-arguments");
} else {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    fail("invalid-policy");
  }

  if (manifest !== undefined) {
    const policyErrors = validateDeploymentManifest(manifest);
    if (policyErrors.length > 0) {
      fail("invalid-policy");
    } else {
      const gateErrors = validateManualDeploymentPolicy(manifest, {
        requireEnabled: true,
      });
      if (gateErrors.length > 0) {
        fail("disabled");
      } else if (
        validateDeploymentManifest(manifest, { requireLinked: true }).length > 0
      ) {
        fail("invalid-policy");
      } else {
        process.stdout.write("vercel-preview-bootstrap: PASS\n");
      }
    }
  }
}
