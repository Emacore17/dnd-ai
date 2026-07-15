import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import { parse } from "yaml";

import { validateCiDocuments } from "../../scripts/lib/ci-workflow-policy.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

test("the GitHub Actions pipeline satisfies the versioned CI policy", async () => {
  const [workflowSource, setupActionSource, packageSource] = await Promise.all([
    readFile(
      path.join(repositoryRoot, ".github", "workflows", "ci.yml"),
      "utf8",
    ),
    readFile(
      path.join(
        repositoryRoot,
        ".github",
        "actions",
        "setup-workspace",
        "action.yml",
      ),
      "utf8",
    ),
    readFile(path.join(repositoryRoot, "package.json"), "utf8"),
  ]);

  const packageManifest = JSON.parse(packageSource);

  assert.deepEqual(
    validateCiDocuments(
      parse(workflowSource),
      parse(setupActionSource),
      packageManifest,
    ),
    [],
  );
});

test("unpinned actions, privileged PR triggers and broad artifacts fail closed", () => {
  const unsafeWorkflow = {
    on: { pull_request_target: {} },
    permissions: { contents: "write" },
    jobs: {
      quality: {
        steps: [{ uses: "actions/checkout@v7" }],
      },
      build: {
        steps: [
          {
            uses: `actions/upload-artifact@${"a".repeat(40)}`,
            with: { path: ".", "include-hidden-files": true },
          },
        ],
      },
    },
  };
  const errors = validateCiDocuments(unsafeWorkflow, {}, {});

  assert.ok(errors.some((error) => error.includes("pull_request_target")));
  assert.ok(errors.some((error) => error.includes("unpinned action")));
  assert.ok(errors.some((error) => error.includes("artifact path")));
});

test("the security audit uses one bulk-capable pnpm pin across local and CI", () => {
  const setupAction = {
    runs: {
      using: "composite",
      steps: [
        {
          uses: `pnpm/action-setup@${"a".repeat(40)}`,
          with: { version: "10.34.5" },
        },
      ],
    },
  };
  const packageManifest = {
    packageManager: "pnpm@10.34.5",
    engines: { pnpm: ">=10.34.5 <11" },
  };
  const errors = validateCiDocuments({}, setupAction, packageManifest);

  assert.ok(errors.some((error) => error.includes("bulk-capable pnpm")));
});

test("pnpm 11 project settings stay fail-closed and reproducible", async () => {
  const workspaceSource = await readFile(
    path.join(repositoryRoot, "pnpm-workspace.yaml"),
    "utf8",
  );
  const workspace = parse(workspaceSource);

  assert.equal(workspace.autoInstallPeers, false);
  assert.equal(workspace.enableGlobalVirtualStore, false);
  assert.equal(workspace.engineStrict, true);
  assert.equal(workspace.saveExact, true);
  assert.equal(workspace.verifyDepsBeforeRun, "error");
});

test("the dependency audit cannot ignore registry failures", async () => {
  const [workflowSource, setupActionSource, packageSource] = await Promise.all([
    readFile(
      path.join(repositoryRoot, ".github", "workflows", "ci.yml"),
      "utf8",
    ),
    readFile(
      path.join(
        repositoryRoot,
        ".github",
        "actions",
        "setup-workspace",
        "action.yml",
      ),
      "utf8",
    ),
    readFile(path.join(repositoryRoot, "package.json"), "utf8"),
  ]);
  const workflow = parse(workflowSource);
  const auditStep = workflow.jobs.security.steps.find((step) =>
    String(step.run ?? "").startsWith("pnpm audit"),
  );

  auditStep.run += " --ignore-registry-errors";

  const errors = validateCiDocuments(
    workflow,
    parse(setupActionSource),
    JSON.parse(packageSource),
  );

  assert.ok(errors.some((error) => error.includes("exact audit command")));
});

test("the quality gate composes documentation and generated contract checks", async () => {
  const [workflowSource, setupActionSource, packageSource] = await Promise.all([
    readFile(
      path.join(repositoryRoot, ".github", "workflows", "ci.yml"),
      "utf8",
    ),
    readFile(
      path.join(
        repositoryRoot,
        ".github",
        "actions",
        "setup-workspace",
        "action.yml",
      ),
      "utf8",
    ),
    readFile(path.join(repositoryRoot, "package.json"), "utf8"),
  ]);
  const workflow = parse(workflowSource);
  const documentationSteps = workflow.jobs.quality.steps.filter(
    (step) => step.run === "pnpm docs:check",
  );
  const checkoutStep = workflow.jobs.quality.steps.find((step) =>
    String(step.uses ?? "").startsWith("actions/checkout@"),
  );

  assert.equal(documentationSteps.length, 1);
  assert.equal(
    workflow.jobs.quality.steps.some(
      (step) =>
        step.run === "pnpm contracts:check" || step.run === "pnpm tasks:check",
    ),
    false,
  );
  assert.equal(checkoutStep.with["fetch-depth"], 2);
  assert.equal(documentationSteps[0].env.CONTRACT_BASE_REF, "HEAD^1");

  checkoutStep.with["fetch-depth"] = 1;
  delete documentationSteps[0].env;
  const errors = validateCiDocuments(
    workflow,
    parse(setupActionSource),
    JSON.parse(packageSource),
  );

  assert.ok(errors.some((error) => error.includes("fetch-depth: 2")));
  assert.ok(errors.some((error) => error.includes("CONTRACT_BASE_REF")));
});

test("the quality gate rejects legacy duplicate document checks", async () => {
  const [workflowSource, setupActionSource, packageSource] = await Promise.all([
    readFile(
      path.join(repositoryRoot, ".github", "workflows", "ci.yml"),
      "utf8",
    ),
    readFile(
      path.join(
        repositoryRoot,
        ".github",
        "actions",
        "setup-workspace",
        "action.yml",
      ),
      "utf8",
    ),
    readFile(path.join(repositoryRoot, "package.json"), "utf8"),
  ]);
  const workflow = parse(workflowSource);
  workflow.jobs.quality.steps.push(
    { run: "pnpm  contracts:check" },
    { run: 'pnpm "tasks:check"' },
  );

  const errors = validateCiDocuments(
    workflow,
    parse(setupActionSource),
    JSON.parse(packageSource),
  );

  assert.ok(
    errors.includes(
      "quality must not duplicate legacy command: pnpm contracts:check",
    ),
  );
  assert.ok(
    errors.includes(
      "quality must not duplicate legacy command: pnpm tasks:check",
    ),
  );
});
