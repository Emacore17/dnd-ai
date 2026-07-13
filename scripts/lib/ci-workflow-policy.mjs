const ACTION_PIN_PATTERN =
  // The bounded character classes contain no ambiguous backtracking path.
  // eslint-disable-next-line security/detect-unsafe-regex
  /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_./-]+)?@[a-f0-9]{40}$/;
const REQUIRED_JOBS = Object.freeze([
  "quality",
  "tests",
  "security",
  "build",
  "ci-required",
]);

function hasKey(value, key) {
  return value && Object.prototype.hasOwnProperty.call(value, key);
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  return value === undefined ? [] : [value];
}

function allSteps(workflow, setupAction) {
  const workflowSteps = Object.entries(workflow.jobs ?? {}).flatMap(
    ([jobName, job]) =>
      asArray(job.steps).map((step, index) => ({
        owner: `jobs.${jobName}.steps.${index}`,
        step,
      })),
  );
  const setupSteps = asArray(setupAction.runs?.steps).map((step, index) => ({
    owner: `setup-workspace.steps.${index}`,
    step,
  }));

  return [...workflowSteps, ...setupSteps];
}

function runText(job) {
  return asArray(job?.steps)
    .map((step) => step.run ?? "")
    .join("\n");
}

function requireCommands(errors, jobName, job, commands) {
  const source = runText(job);

  for (const command of commands) {
    if (!source.includes(command)) {
      errors.push(`${jobName} missing command: ${command}`);
    }
  }
}

function validateTriggers(errors, workflow) {
  const triggers = workflow.on ?? {};

  if (hasKey(triggers, "pull_request_target")) {
    errors.push("pull_request_target is forbidden");
  }

  for (const trigger of [
    "pull_request",
    "push",
    "merge_group",
    "workflow_dispatch",
  ]) {
    if (!hasKey(triggers, trigger)) {
      errors.push(`missing workflow trigger: ${trigger}`);
    }
  }

  if (!asArray(triggers.push?.branches).includes("main")) {
    errors.push("push trigger must target main");
  }

  if (triggers.pull_request?.paths || triggers.pull_request?.["paths-ignore"]) {
    errors.push("required PR workflow must not use path filters");
  }
}

function validatePermissions(errors, workflow) {
  const permissions = workflow.permissions ?? {};

  if (
    permissions.contents !== "read" ||
    Object.keys(permissions).some((permission) => permission !== "contents")
  ) {
    errors.push("workflow permissions must be contents: read only");
  }

  if (workflow.jobs?.security?.permissions !== undefined) {
    errors.push("security job must inherit the read-only workflow permissions");
  }
}

function validateSteps(errors, workflow, setupAction) {
  for (const { owner, step } of allSteps(workflow, setupAction)) {
    if (step["continue-on-error"] === true) {
      errors.push(`${owner} must not continue on error`);
    }

    if (step.uses && !step.uses.startsWith("./")) {
      if (!ACTION_PIN_PATTERN.test(step.uses)) {
        errors.push(`${owner} uses unpinned action: ${step.uses}`);
      }
    }

    if (step.uses?.startsWith("actions/checkout@")) {
      const persistsCredentials = step.with?.["persist-credentials"];

      if (![false, "false"].includes(persistsCredentials)) {
        errors.push(`${owner} checkout must disable persisted credentials`);
      }
    }

    if (/\$\{\{\s*secrets\./.test(step.run ?? "")) {
      errors.push(`${owner} must not interpolate secrets in run`);
    }

    if (/\$\{\{\s*github\.event\./.test(step.run ?? "")) {
      errors.push(`${owner} must not interpolate event data in run`);
    }
  }
}

function validateSetupAction(errors, setupAction) {
  if (setupAction.runs?.using !== "composite") {
    errors.push("setup-workspace must be a composite action");
  }

  const steps = asArray(setupAction.runs?.steps);
  const nodeSetup = steps.find((step) =>
    step.uses?.startsWith("actions/setup-node@"),
  );

  if (
    nodeSetup?.with?.cache !== "pnpm" ||
    nodeSetup.with?.["cache-dependency-path"] !== "pnpm-lock.yaml"
  ) {
    errors.push(
      "setup-node cache must contain only the pnpm lockfile-scoped store",
    );
  }

  if (!steps.some((step) => step.run === "pnpm install --frozen-lockfile")) {
    errors.push("setup-workspace must install the frozen lockfile");
  }
}

function validateJobs(errors, workflow) {
  const jobs = workflow.jobs ?? {};

  for (const jobName of REQUIRED_JOBS) {
    if (!jobs[jobName]) {
      errors.push(`missing required job: ${jobName}`);
    }
  }

  for (const [jobName, job] of Object.entries(jobs)) {
    const timeout = job["timeout-minutes"];

    if (job["runs-on"] !== "ubuntu-24.04") {
      errors.push(`${jobName} must use an ephemeral ubuntu-24.04 runner`);
    }

    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 30) {
      errors.push(`${jobName} must have a timeout between 1 and 30 minutes`);
    }

    if (job["continue-on-error"] === true) {
      errors.push(`${jobName} must not continue on error`);
    }
  }

  for (const jobName of ["quality", "tests", "security", "build"]) {
    if (
      !asArray(jobs[jobName]?.steps).some(
        (step) => step.uses === "./.github/actions/setup-workspace",
      )
    ) {
      errors.push(`${jobName} must use the pinned workspace setup action`);
    }
  }

  requireCommands(errors, "quality", jobs.quality, [
    "pnpm format:check",
    "pnpm lint",
    "pnpm typecheck",
    "pnpm boundaries:check",
    "pnpm tasks:check",
    "pnpm ci:workflow:check",
  ]);
  requireCommands(errors, "tests", jobs.tests, [
    "pnpm test:unit",
    "pnpm test:component",
    "pnpm test:integration",
    "pnpm test:contract",
    "playwright install --with-deps chromium",
    "pnpm test:e2e",
  ]);
  requireCommands(errors, "security", jobs.security, [
    "pnpm scan:sast",
    "pnpm test:security",
    "pnpm audit --audit-level=high",
  ]);
  requireCommands(errors, "build", jobs.build, [
    "pnpm build",
    "pnpm artifact:prepare",
    "pnpm artifact:verify",
    "pnpm artifact:smoke",
  ]);

  const buildNeeds = asArray(jobs.build?.needs);
  for (const dependency of ["quality", "tests", "security"]) {
    if (!buildNeeds.includes(dependency)) {
      errors.push(`build must depend on ${dependency}`);
    }
  }

  const requiredJob = jobs["ci-required"] ?? {};

  if (requiredJob.name !== "CI / Merge gate") {
    errors.push("ci-required must keep the stable name CI / Merge gate");
  }
  const requiredNeeds = asArray(requiredJob.needs);
  for (const dependency of ["quality", "tests", "security", "build"]) {
    if (!requiredNeeds.includes(dependency)) {
      errors.push(`ci-required must depend on ${dependency}`);
    }
  }

  if (!String(requiredJob.if ?? "").includes("always()")) {
    errors.push("ci-required must run with always()");
  }

  if (!runText(requiredJob).includes("node scripts/assert-ci-results.mjs")) {
    errors.push("ci-required must execute the versioned fan-in assertion");
  }

  const artifactStep = asArray(jobs.build?.steps).find((step) =>
    step.uses?.startsWith("actions/upload-artifact@"),
  );

  if (artifactStep?.with?.path !== "artifacts/bl002") {
    errors.push("build artifact path must be artifacts/bl002");
  }

  if (![true, "true"].includes(artifactStep?.with?.["include-hidden-files"])) {
    errors.push("validated Next standalone artifact must include hidden files");
  }

  if (artifactStep?.with?.["if-no-files-found"] !== "error") {
    errors.push("build artifact must fail when files are missing");
  }

  const retentionDays = Number(artifactStep?.with?.["retention-days"]);
  if (!Number.isInteger(retentionDays) || retentionDays > 7) {
    errors.push("build artifact retention must be seven days or less");
  }
}

export function validateCiDocuments(workflow, setupAction) {
  const errors = [];
  validateTriggers(errors, workflow);
  validatePermissions(errors, workflow);
  validateSteps(errors, workflow, setupAction);
  validateSetupAction(errors, setupAction);
  validateJobs(errors, workflow);

  if (workflow.concurrency?.["cancel-in-progress"] !== true) {
    errors.push("workflow concurrency must cancel stale runs");
  }

  if (!workflow.concurrency?.group) {
    errors.push("workflow concurrency must define an isolation group");
  }

  return [...new Set(errors)].sort();
}
