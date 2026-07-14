const PROJECT_ID_PATTERN = /^prj_[A-Za-z0-9]+$/;
// The bounded character classes contain no ambiguous backtracking path.
// eslint-disable-next-line security/detect-unsafe-regex
const PROJECT_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,98}[a-z0-9])?$/;
// Vercel scope slugs share the same bounded public-slug alphabet.
// eslint-disable-next-line security/detect-unsafe-regex
const SCOPE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,46}[a-z0-9])?$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function expectEqual(errors, label, actual, expected) {
  if (actual !== expected) {
    errors.push(`${label} must be ${JSON.stringify(expected)}`);
  }
}

function expectArray(errors, label, actual, expected) {
  if (
    !Array.isArray(actual) ||
    JSON.stringify(actual) !== JSON.stringify(expected)
  ) {
    errors.push(`${label} must be ${JSON.stringify(expected)}`);
  }
}

function expectKeys(errors, label, actual, expectedKeys) {
  if (!isRecord(actual)) {
    errors.push(`${label} must be an object`);
    return;
  }

  const actualKeys = Object.keys(actual).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(sortedExpectedKeys)) {
    errors.push(`${label} must contain only ${sortedExpectedKeys.join(", ")}`);
  }
}

export function validateDeploymentManifest(
  manifest,
  { requireLinked = false } = {},
) {
  const errors = [];

  expectKeys(errors, "manifest", manifest, [
    "contractVersion",
    "deploymentProtection",
    "environments",
    "provider",
    "runtimes",
    "source",
  ]);
  expectEqual(
    errors,
    "contractVersion",
    manifest?.contractVersion,
    "staging-foundation-v1",
  );

  const provider = manifest?.provider;
  expectKeys(errors, "provider", provider, [
    "cliVersion",
    "name",
    "project",
    "regions",
  ]);
  expectEqual(errors, "provider.name", provider?.name, "vercel");
  if (!VERSION_PATTERN.test(provider?.cliVersion ?? "")) {
    errors.push("provider.cliVersion must be an exact semantic version");
  }
  expectArray(errors, "provider.regions", provider?.regions, ["fra1"]);

  const project = provider?.project;
  expectKeys(errors, "provider.project", project, [
    "framework",
    "id",
    "name",
    "rootDirectory",
    "scopeSlug",
    "stagingOrigin",
  ]);
  if (!PROJECT_NAME_PATTERN.test(project?.name ?? "")) {
    errors.push("provider.project.name must be a valid Vercel project name");
  }
  expectEqual(errors, "provider.project.name", project?.name, "dnd-ai-web");
  expectEqual(
    errors,
    "provider.project.rootDirectory",
    project?.rootDirectory,
    "apps/web",
  );
  expectEqual(
    errors,
    "provider.project.framework",
    project?.framework,
    "nextjs",
  );
  if (project?.id !== null && !PROJECT_ID_PATTERN.test(project?.id ?? "")) {
    errors.push("provider.project.id must be null or a Vercel project ID");
  }
  if (requireLinked && project?.id === null) {
    errors.push("provider.project.id is required after provider linking");
  }
  if (
    project?.scopeSlug !== null &&
    !SCOPE_SLUG_PATTERN.test(project?.scopeSlug ?? "")
  ) {
    errors.push(
      "provider.project.scopeSlug must be null or a valid Vercel scope slug",
    );
  }
  if (requireLinked && project?.scopeSlug === null) {
    errors.push(
      "provider.project.scopeSlug is required after provider linking",
    );
  }
  if (project?.stagingOrigin !== null) {
    const expectedStagingOrigin =
      project?.scopeSlug === null
        ? null
        : `https://${project?.name}-git-main-${project.scopeSlug}.vercel.app`;
    if (project.stagingOrigin !== expectedStagingOrigin) {
      errors.push(
        "provider.project.stagingOrigin must be the exact main branch alias in the linked Vercel scope",
      );
    }
  }
  if (requireLinked && project?.stagingOrigin === null) {
    errors.push(
      "provider.project.stagingOrigin is required after provider linking",
    );
  }

  const source = manifest?.source;
  expectKeys(errors, "source", source, [
    "activationDeploymentPolicy",
    "autoDeploy",
    "forkProtection",
    "installationId",
    "integration",
    "productionBranch",
    "repository",
    "stagingBranch",
  ]);
  expectEqual(
    errors,
    "source.repository",
    source?.repository,
    "Emacore17/dnd-ai",
  );
  if (typeof source?.autoDeploy !== "boolean") {
    errors.push("source.autoDeploy must be a boolean");
  }
  expectKeys(
    errors,
    "source.activationDeploymentPolicy",
    source?.activationDeploymentPolicy,
    ["**", "main", "release/production"],
  );
  expectEqual(
    errors,
    "source.activationDeploymentPolicy.**",
    source?.activationDeploymentPolicy?.["**"],
    false,
  );
  expectEqual(
    errors,
    "source.activationDeploymentPolicy.main",
    source?.activationDeploymentPolicy?.main,
    true,
  );
  expectEqual(
    errors,
    "source.activationDeploymentPolicy.release/production",
    source?.activationDeploymentPolicy?.["release/production"],
    false,
  );
  expectEqual(
    errors,
    "source.integration",
    source?.integration,
    "vercel-github-app",
  );
  if (
    source?.installationId !== null &&
    (!Number.isSafeInteger(source?.installationId) ||
      source.installationId <= 0)
  ) {
    errors.push(
      "source.installationId must be null or a positive GitHub App installation ID",
    );
  }
  if (requireLinked && source?.installationId === null) {
    errors.push(
      "source.installationId is required after GitHub App installation",
    );
  }
  const providerBindings = [
    project?.id,
    project?.scopeSlug,
    project?.stagingOrigin,
    source?.installationId,
  ];
  const populatedProviderBindings = providerBindings.filter(
    (value) => value !== null,
  ).length;
  if (
    populatedProviderBindings !== 0 &&
    populatedProviderBindings !== providerBindings.length
  ) {
    errors.push(
      "provider project ID, scope slug, staging origin and GitHub App installation ID must be recorded atomically",
    );
  }
  expectEqual(errors, "source.stagingBranch", source?.stagingBranch, "main");
  expectEqual(
    errors,
    "source.productionBranch",
    source?.productionBranch,
    "release/production",
  );
  expectEqual(errors, "source.forkProtection", source?.forkProtection, true);
  if (
    source?.autoDeploy === true &&
    (project?.id === null ||
      project?.scopeSlug === null ||
      project?.stagingOrigin === null ||
      source?.installationId === null)
  ) {
    errors.push(
      "source.autoDeploy requires a linked provider project, staging origin and GitHub App installation",
    );
  }

  const deploymentProtection = manifest?.deploymentProtection;
  expectKeys(errors, "deploymentProtection", deploymentProtection, [
    "method",
    "mode",
    "trustedSource",
  ]);
  expectEqual(
    errors,
    "deploymentProtection.mode",
    deploymentProtection?.mode,
    "standard",
  );
  expectEqual(
    errors,
    "deploymentProtection.method",
    deploymentProtection?.method,
    "vercel-authentication",
  );

  const trustedSource = deploymentProtection?.trustedSource;
  expectKeys(errors, "deploymentProtection.trustedSource", trustedSource, [
    "audience",
    "claims",
    "issuer",
    "provider",
    "targetEnvironments",
  ]);
  expectEqual(
    errors,
    "deploymentProtection.trustedSource.provider",
    trustedSource?.provider,
    "github-actions",
  );
  expectEqual(
    errors,
    "deploymentProtection.trustedSource.issuer",
    trustedSource?.issuer,
    "https://token.actions.githubusercontent.com",
  );
  expectEqual(
    errors,
    "deploymentProtection.trustedSource.audience",
    trustedSource?.audience,
    "https://github.com/Emacore17",
  );
  expectKeys(
    errors,
    "deploymentProtection.trustedSource.claims",
    trustedSource?.claims,
    ["environment", "ref", "repository", "repository_id"],
  );
  expectEqual(
    errors,
    "deploymentProtection.trustedSource.claims.repository",
    trustedSource?.claims?.repository,
    "Emacore17/dnd-ai",
  );
  expectEqual(
    errors,
    "deploymentProtection.trustedSource.claims.repository_id",
    trustedSource?.claims?.repository_id,
    "1299266814",
  );
  expectEqual(
    errors,
    "deploymentProtection.trustedSource.claims.ref",
    trustedSource?.claims?.ref,
    "refs/heads/main",
  );
  expectEqual(
    errors,
    "deploymentProtection.trustedSource.claims.environment",
    trustedSource?.claims?.environment,
    "staging",
  );
  expectArray(
    errors,
    "deploymentProtection.trustedSource.targetEnvironments",
    trustedSource?.targetEnvironments,
    ["preview"],
  );
  if (
    source?.productionBranch &&
    source.productionBranch === source?.stagingBranch
  ) {
    errors.push("production and staging branches must be different");
  }

  const environments = manifest?.environments;
  expectKeys(errors, "environments", environments, [
    "github",
    "secrets",
    "variables",
    "vercel",
  ]);
  expectEqual(errors, "environments.vercel", environments?.vercel, "preview");
  expectEqual(errors, "environments.github", environments?.github, "staging");
  expectArray(errors, "environments.variables", environments?.variables, []);
  expectArray(errors, "environments.secrets", environments?.secrets, []);

  const runtimes = manifest?.runtimes;
  expectKeys(errors, "runtimes", runtimes, ["api", "web", "worker"]);
  expectEqual(errors, "runtimes.web", runtimes?.web, "active");
  expectEqual(errors, "runtimes.api", runtimes?.api, "planned");
  expectEqual(errors, "runtimes.worker", runtimes?.worker, "planned");

  return [...new Set(errors)].sort();
}

export function validateVercelProjectConfig(manifest, config) {
  const errors = [];

  expectKeys(errors, "vercel config", config, [
    "$schema",
    "framework",
    "git",
    "regions",
  ]);
  expectEqual(
    errors,
    "vercel config.$schema",
    config?.$schema,
    "https://openapi.vercel.sh/vercel.json",
  );
  expectEqual(errors, "vercel config.framework", config?.framework, "nextjs");
  expectArray(errors, "vercel config.regions", config?.regions, ["fra1"]);

  const git = config?.git;
  expectKeys(errors, "vercel config.git", git, ["deploymentEnabled"]);
  const deploymentEnabled = git?.deploymentEnabled;
  if (manifest?.source?.autoDeploy === false) {
    expectEqual(
      errors,
      "vercel config.git.deploymentEnabled",
      deploymentEnabled,
      false,
    );
  } else if (manifest?.source?.autoDeploy === true) {
    const activationPolicy = manifest?.source?.activationDeploymentPolicy;
    expectKeys(
      errors,
      "vercel config.git.deploymentEnabled",
      deploymentEnabled,
      ["**", "main", "release/production"],
    );
    for (const branchPattern of ["**", "main", "release/production"]) {
      expectEqual(
        errors,
        `vercel config.git.deploymentEnabled.${branchPattern}`,
        deploymentEnabled?.[branchPattern],
        activationPolicy?.[branchPattern],
      );
    }
  } else {
    errors.push(
      "vercel config.git.deploymentEnabled cannot be validated until source.autoDeploy is boolean",
    );
  }

  return [...new Set(errors)].sort();
}

export function redactIdentifier(value) {
  if (typeof value !== "string" || value.length < 10) {
    return "<redacted>";
  }

  const separator = value.indexOf("_");
  const prefix = separator >= 0 ? value.slice(0, separator + 1) : "";
  return `${prefix}…${value.slice(-6)}`;
}

export function redactDeploymentOrigin(projectName) {
  return `https://${projectName}-….vercel.app`;
}
