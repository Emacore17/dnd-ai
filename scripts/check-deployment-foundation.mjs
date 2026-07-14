import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

import { parse } from "yaml";

import {
  validateDeploymentManifest,
  validateVercelIgnorePolicy,
  validateVercelProjectConfig,
  validateWebBuildPolicy,
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

async function pathExists(...segments) {
  try {
    await stat(path.join(repositoryRoot, ...segments));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

const [
  manifest,
  workflow,
  vercelConfig,
  webPackage,
  turboConfig,
  vercelIgnore,
  hasProjectLevelVercelIgnore,
] = await Promise.all([
  readJson("infra", "deployment", "vercel-staging.json"),
  readYaml(".github", "workflows", "deployment-smoke.yml"),
  readJson("apps", "web", "vercel.json"),
  readJson("apps", "web", "package.json"),
  readJson("turbo.json"),
  readFile(path.join(repositoryRoot, ".vercelignore"), "utf8"),
  pathExists("apps", "web", ".vercelignore"),
]);
const requireLinked = process.argv.includes("--require-linked");
const errors = [
  ...validateDeploymentManifest(manifest, { requireLinked }),
  ...validateVercelProjectConfig(manifest, vercelConfig),
  ...validateWebBuildPolicy(webPackage, turboConfig),
  ...validateVercelIgnorePolicy(vercelIgnore, {
    hasProjectLevelOverride: hasProjectLevelVercelIgnore,
  }),
  ...validateDeploymentWorkflow(workflow),
];

if (errors.length > 0) {
  console.error(["deployment-foundation: FAIL", ...errors].join("\n"));
  process.exitCode = 1;
} else {
  console.log("deployment-foundation: PASS");
}
