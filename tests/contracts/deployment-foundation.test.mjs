import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import { parse } from "yaml";

import {
  validateDeploymentManifest,
  validateVercelIgnorePolicy,
  validateVercelProjectConfig,
  validateWebBuildPolicy,
} from "../../scripts/lib/deployment-foundation.mjs";
import { validateDeploymentWorkflow } from "../../scripts/lib/deployment-workflow-policy.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

async function readJson(...segments) {
  return JSON.parse(
    await readFile(path.join(repositoryRoot, ...segments), "utf8"),
  );
}

test("the Vercel staging manifest and GitHub smoke workflow satisfy policy", async () => {
  const [
    manifest,
    workflow,
    ciWorkflow,
    vercelConfig,
    webPackage,
    turboConfig,
    vercelIgnore,
    gitignore,
    healthRoute,
  ] = await Promise.all([
    readJson("infra", "deployment", "vercel-staging.json"),
    readFile(
      path.join(repositoryRoot, ".github", "workflows", "deployment-smoke.yml"),
      "utf8",
    ).then(parse),
    readFile(
      path.join(repositoryRoot, ".github", "workflows", "ci.yml"),
      "utf8",
    ).then(parse),
    readJson("apps", "web", "vercel.json"),
    readJson("apps", "web", "package.json"),
    readJson("turbo.json"),
    readFile(path.join(repositoryRoot, ".vercelignore"), "utf8"),
    readFile(path.join(repositoryRoot, ".gitignore"), "utf8"),
    readFile(
      path.join(repositoryRoot, "apps", "web", "app", "health", "route.ts"),
      "utf8",
    ),
  ]);

  assert.deepEqual(validateDeploymentManifest(manifest), []);
  assert.deepEqual(validateVercelProjectConfig(manifest, vercelConfig), []);
  assert.deepEqual(validateWebBuildPolicy(webPackage, turboConfig), []);
  assert.deepEqual(validateVercelIgnorePolicy(vercelIgnore), []);
  assert.deepEqual(validateDeploymentWorkflow(workflow), []);
  assert.deepEqual(manifest.source.activationDeploymentPolicy, {
    "**": false,
    main: true,
    "release/production": false,
  });
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
    buildCommand:
      "node scripts/assert-vercel-preview-build.mjs && pnpm run build",
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

  const unguardedWebPackage = globalThis.structuredClone(webPackage);
  unguardedWebPackage.scripts.build = "next build";
  assert.ok(
    validateWebBuildPolicy(unguardedWebPackage, turboConfig).some((error) =>
      error.includes("web package.scripts.build"),
    ),
    "the package build must not bypass the Preview guard",
  );

  const permissiveProviderConfig = globalThis.structuredClone(vercelConfig);
  permissiveProviderConfig.buildCommand =
    "node scripts/assert-vercel-preview-build.mjs --allow-local && pnpm run build";
  assert.ok(
    validateVercelProjectConfig(manifest, permissiveProviderConfig).some(
      (error) => error.includes("vercel config.buildCommand"),
    ),
    "the provider build must invoke the guard without local fallback",
  );

  const unkeyedTurboConfig = globalThis.structuredClone(turboConfig);
  delete unkeyedTurboConfig.tasks.build.env;
  assert.ok(
    validateWebBuildPolicy(webPackage, unkeyedTurboConfig).some((error) =>
      error.includes("turbo tasks.build.env"),
    ),
    "Vercel target metadata must participate in the build cache key",
  );

  const missingTurboIgnore = vercelIgnore.replace(".turbo/\n", "");
  assert.ok(
    validateVercelIgnorePolicy(missingTurboIgnore).some((error) =>
      error.includes(".vercelignore patterns"),
    ),
    "the CLI upload policy must exclude local Turbo cache",
  );

  const whitespacePrefixedTurboIgnore = vercelIgnore.replace(
    ".turbo/\n",
    " .turbo/\n",
  );
  assert.ok(
    validateVercelIgnorePolicy(whitespacePrefixedTurboIgnore).some((error) =>
      error.includes(".vercelignore patterns"),
    ),
    "the upload policy must reject whitespace that changes ignore semantics",
  );

  assert.ok(
    validateVercelIgnorePolicy(vercelIgnore, {
      hasProjectLevelOverride: true,
    }).some((error) => error.includes("apps/web/.vercelignore")),
    "a project-level ignore file must not silently override the root policy",
  );

  const activationStateDrift = globalThis.structuredClone(vercelConfig);
  activationStateDrift.git.deploymentEnabled = manifest.source.autoDeploy
    ? false
    : manifest.source.activationDeploymentPolicy;
  assert.ok(
    validateVercelProjectConfig(manifest, activationStateDrift).some((error) =>
      error.includes("vercel config.git.deploymentEnabled"),
    ),
    "the repository config and activation state must not drift",
  );
});

test("deployment branch policy denies every branch except staging main", async () => {
  const manifest = await readJson("infra", "deployment", "vercel-staging.json");

  const singleStarFallback = globalThis.structuredClone(manifest);
  singleStarFallback.source.activationDeploymentPolicy = {
    "*": false,
    main: true,
    "release/production": false,
  };
  assert.ok(
    validateDeploymentManifest(singleStarFallback).some((error) =>
      error.includes("source.activationDeploymentPolicy"),
    ),
    "a single-star fallback must not stand in for the recursive minimatch glob",
  );

  const productionEnabled = globalThis.structuredClone(manifest);
  productionEnabled.source.activationDeploymentPolicy["release/production"] =
    true;
  assert.ok(
    validateDeploymentManifest(productionEnabled).some((error) =>
      error.includes(
        "source.activationDeploymentPolicy.release/production must be false",
      ),
    ),
    "the production branch must remain explicitly disabled",
  );
});

test("provider bindings are either all absent or all recorded", async () => {
  const manifest = await readJson("infra", "deployment", "vercel-staging.json");
  const unlinkedBaseline = globalThis.structuredClone(manifest);
  unlinkedBaseline.provider.project.id = null;
  unlinkedBaseline.provider.project.scopeSlug = null;
  unlinkedBaseline.provider.project.stagingOrigin = null;
  unlinkedBaseline.source.installationId = null;
  unlinkedBaseline.source.autoDeploy = false;
  assert.deepEqual(validateDeploymentManifest(unlinkedBaseline), []);

  const partialBindings = [
    [
      "project ID",
      (candidate) => (candidate.provider.project.id = "prj_1234567890"),
    ],
    [
      "scope slug",
      (candidate) =>
        (candidate.provider.project.scopeSlug = "emacore17s-projects"),
    ],
    [
      "staging origin",
      (candidate) =>
        (candidate.provider.project.stagingOrigin =
          "https://dnd-ai-web-git-main-emacore17s-projects.vercel.app"),
    ],
    [
      "installation ID",
      (candidate) => (candidate.source.installationId = 41079282),
    ],
  ];

  for (const [label, applyBinding] of partialBindings) {
    const candidate = globalThis.structuredClone(unlinkedBaseline);
    applyBinding(candidate);
    assert.ok(
      validateDeploymentManifest(candidate).some((error) =>
        error.includes("must be recorded atomically"),
      ),
      `${label} alone must fail the provider binding policy`,
    );
  }
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
      activationDeploymentPolicy: {
        "**": true,
        main: true,
        "release/production": true,
      },
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
    "activationDeploymentPolicy.**",
    "activationDeploymentPolicy.release/production",
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
