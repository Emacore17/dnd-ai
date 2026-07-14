import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

import { parse } from "yaml";

import {
  validateDeploymentManifest,
  validateVercelProjectConfig,
} from "./lib/deployment-foundation.mjs";
import { validateDeploymentWorkflow } from "./lib/deployment-workflow-policy.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

async function readJson(...segments) {
  return JSON.parse(
    await readFile(path.join(repositoryRoot, ...segments), "utf8"),
  );
}

async function readYaml(...segments) {
  return parse(await readFile(path.join(repositoryRoot, ...segments), "utf8"));
}

const [manifest, workflow, vercelConfig] = await Promise.all([
  readJson("infra", "deployment", "vercel-staging.json"),
  readYaml(".github", "workflows", "deployment-smoke.yml"),
  readJson("apps", "web", "vercel.json"),
]);
const requireLinked = process.argv.includes("--require-linked");
const errors = [
  ...validateDeploymentManifest(manifest, { requireLinked }),
  ...validateVercelProjectConfig(manifest, vercelConfig),
  ...validateDeploymentWorkflow(workflow),
];

if (errors.length > 0) {
  console.error(["deployment-foundation: FAIL", ...errors].join("\n"));
  process.exitCode = 1;
} else {
  console.log("deployment-foundation: PASS");
}
