import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import { parse } from "yaml";

import { validateDeploymentManifest } from "../../scripts/lib/deployment-foundation.mjs";
import { validateDeploymentWorkflow } from "../../scripts/lib/deployment-workflow-policy.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

async function readJson(...segments) {
  return JSON.parse(
    await readFile(path.join(repositoryRoot, ...segments), "utf8"),
  );
}

test("the Vercel staging manifest and GitHub smoke workflow satisfy policy", async () => {
  const [manifest, workflow, ciWorkflow, vercelConfig, gitignore, healthRoute] =
    await Promise.all([
      readJson("infra", "deployment", "vercel-staging.json"),
      readFile(
        path.join(
          repositoryRoot,
          ".github",
          "workflows",
          "deployment-smoke.yml",
        ),
        "utf8",
      ).then(parse),
      readFile(
        path.join(repositoryRoot, ".github", "workflows", "ci.yml"),
        "utf8",
      ).then(parse),
      readJson("apps", "web", "vercel.json"),
      readFile(path.join(repositoryRoot, ".gitignore"), "utf8"),
      readFile(
        path.join(repositoryRoot, "apps", "web", "app", "health", "route.ts"),
        "utf8",
      ),
    ]);

  assert.deepEqual(validateDeploymentManifest(manifest), []);
  assert.deepEqual(validateDeploymentWorkflow(workflow), []);
  const renamedProject = globalThis.structuredClone(manifest);
  renamedProject.provider.project.name = "lookalike-web";
  assert.ok(
    validateDeploymentManifest(renamedProject).some((error) =>
      error.includes('provider.project.name must be "dnd-ai-web"'),
    ),
  );
  const qualityRun = JSON.stringify(ciWorkflow.jobs?.quality?.steps ?? []);
  assert.match(qualityRun, /pnpm deploy:check/);
  if (manifest.source.autoDeploy) {
    assert.match(qualityRun, /pnpm deploy:check:linked/);
  } else {
    assert.doesNotMatch(qualityRun, /pnpm deploy:check:linked/);
  }
  const linkedErrors = validateDeploymentManifest(manifest, {
    requireLinked: true,
  });
  if (manifest.provider.project.id === null) {
    assert.ok(
      linkedErrors.some((error) => error.includes("project.id is required")),
      "the plan must fail closed until a real non-secret project ID is recorded",
    );
    assert.ok(
      linkedErrors.some((error) =>
        error.includes("project.scopeSlug is required"),
      ),
      "the plan must bind the deployment hostname to a real Vercel scope",
    );
    assert.ok(
      linkedErrors.some((error) =>
        error.includes("project.stagingOrigin is required"),
      ),
      "the plan must record the exact trusted branch origin",
    );
    assert.ok(
      linkedErrors.some((error) =>
        error.includes("source.installationId is required"),
      ),
      "the plan must bind dispatch events to the Vercel GitHub App",
    );
  } else {
    assert.deepEqual(linkedErrors, []);
  }
  assert.deepEqual(vercelConfig, {
    $schema: "https://openapi.vercel.sh/vercel.json",
    framework: "nextjs",
    git: {
      deploymentEnabled: manifest.source.autoDeploy
        ? manifest.source.activationDeploymentPolicy
        : false,
    },
    regions: ["fra1"],
  });
  assert.match(gitignore, /^\.vercel\/$/m);
  assert.match(healthRoute, /web-health-v1/);
  assert.match(healthRoute, /VERCEL_PROJECT_ID/);
  assert.match(healthRoute, /VERCEL_DEPLOYMENT_ID/);
  assert.match(healthRoute, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(healthRoute, /VERCEL_GIT_COMMIT_REF/);
  assert.match(healthRoute, /VERCEL_GIT_REPO_OWNER/);
  assert.match(healthRoute, /VERCEL_GIT_REPO_SLUG/);
  assert.match(healthRoute, /VERCEL_GIT_REPO_ID/);
  assert.match(healthRoute, /VERCEL_REGION/);
  assert.doesNotMatch(healthRoute, /NEXT_PUBLIC_/);
});

test("deployment workflow rejects job permission overrides and additional jobs", async () => {
  const workflow = parse(
    await readFile(
      path.join(repositoryRoot, ".github", "workflows", "deployment-smoke.yml"),
      "utf8",
    ),
  );
  const permissionOverride = globalThis.structuredClone(workflow);
  permissionOverride.jobs.smoke.permissions = {
    contents: "write",
    "id-token": "write",
  };
  assert.ok(
    validateDeploymentWorkflow(permissionOverride).some((error) =>
      error.includes("job-level permissions"),
    ),
  );

  const extraJob = globalThis.structuredClone(workflow);
  extraJob.jobs.exfiltrate = {
    "runs-on": "ubuntu-24.04",
    permissions: "write-all",
    steps: [{ run: "true" }],
  };
  assert.ok(
    validateDeploymentWorkflow(extraJob).some((error) =>
      error.includes("only the smoke job"),
    ),
  );

  const extraStep = globalThis.structuredClone(workflow);
  extraStep.jobs.smoke.steps.splice(3, 0, {
    name: "Untrusted token consumer",
    run: "node attacker.mjs",
  });
  assert.ok(
    validateDeploymentWorkflow(extraStep).some((error) =>
      error.includes("closed trusted smoke sequence"),
    ),
  );

  const modifiedOidc = globalThis.structuredClone(workflow);
  modifiedOidc.jobs.smoke.steps[2].with.script +=
    "core.info(`token=${token}`);\n";
  assert.ok(
    validateDeploymentWorkflow(modifiedOidc).some((error) =>
      error.includes("closed trusted smoke sequence"),
    ),
  );
});

test("unsafe deployment workflow and environment drift fail closed", () => {
  const unsafeWorkflow = {
    on: {
      pull_request_target: {},
      repository_dispatch: { types: ["vercel.deployment.success"] },
    },
    permissions: { contents: "write", deployments: "write" },
    jobs: {
      smoke: {
        name: "Unsafe",
        "runs-on": "ubuntu-latest",
        "timeout-minutes": 30,
        environment: { name: "production" },
        steps: [
          { uses: "actions/checkout@v7" },
          {
            run: "vercel deploy --prod ${{ github.event.client_payload.url }}",
            env: { VERCEL_TOKEN: "${{ secrets.VERCEL_TOKEN }}" },
          },
        ],
      },
    },
  };
  const workflowErrors = validateDeploymentWorkflow(unsafeWorkflow);

  for (const expected of [
    "pull_request_target",
    "exactly contents: read and id-token: write",
    "unpinned action",
    "protected staging environment",
    "event payload",
    "VERCEL_TOKEN",
    "--prod",
  ]) {
    assert.ok(
      workflowErrors.some((error) => error.includes(expected)),
      `${expected}: ${workflowErrors.join("; ")}`,
    );
  }

  const driftedManifest = {
    contractVersion: "staging-foundation-v1",
    provider: {
      name: "vercel",
      cliVersion: "latest",
      project: {
        name: "dnd-ai-web",
        id: null,
        scopeSlug: null,
        stagingOrigin: null,
        rootDirectory: ".",
        framework: "other",
      },
      regions: ["iad1"],
    },
    source: {
      repository: "Emacore17/dnd-ai",
      integration: "token",
      installationId: null,
      autoDeploy: true,
      activationDeploymentPolicy: { "*": true, main: true },
      stagingBranch: "main",
      productionBranch: "main",
      forkProtection: false,
    },
    deploymentProtection: {
      mode: "none",
      method: "none",
      trustedSource: {
        provider: "static-secret",
        issuer: "https://attacker.example",
        audience: "*",
        claims: {},
        targetEnvironments: ["production"],
      },
    },
    environments: {
      vercel: "production",
      github: "production",
      variables: ["UNUSED"],
      secrets: ["VERCEL_TOKEN"],
    },
    runtimes: { web: "active", api: "active", worker: "active" },
  };
  const manifestErrors = validateDeploymentManifest(driftedManifest);

  for (const expected of [
    "semantic version",
    "apps/web",
    "fra1",
    "vercel-github-app",
    "activationDeploymentPolicy.*",
    "release/production",
    "autoDeploy requires",
    "different",
    "[]",
    "runtimes.api",
  ]) {
    assert.ok(
      manifestErrors.some((error) => error.includes(expected)),
      `${expected}: ${manifestErrors.join("; ")}`,
    );
  }
});
