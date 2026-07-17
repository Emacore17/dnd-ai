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
const REQUIRED_PNPM_VERSION = "11.13.0";
const TEST_REPORT_UPLOAD_ACTION =
  "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a";
const TEST_REPORT_LANES = "unit,integration,database,contract,e2e";
const FORBIDDEN_QUALITY_COMMANDS = Object.freeze([
  {
    label: "pnpm contracts:check",
    script: "contracts:check",
  },
  {
    label: "pnpm tasks:check",
    script: "tasks:check",
  },
]);
const SHELL_TOKEN_SEPARATORS = new Set([
  " ",
  "\t",
  "\r",
  "\n",
  "\v",
  "\f",
  ";",
  "&",
  "|",
  "(",
  ")",
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

function shellWords(source) {
  const words = [];
  let current = "";

  for (const character of source) {
    if (character === '"' || character === "'") {
      continue;
    }

    if (SHELL_TOKEN_SEPARATORS.has(character)) {
      if (current) {
        words.push(current);
        current = "";
      }
      continue;
    }

    current += character;
  }

  if (current) {
    words.push(current);
  }

  return words;
}

function hasPnpmScriptInvocation(source, script) {
  const words = shellWords(source);

  return words.some((word, index) => {
    if (word !== "pnpm") {
      return false;
    }

    const scriptIndex = words[index + 1] === "run" ? index + 2 : index + 1;
    return words[scriptIndex] === script;
  });
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

function validatePnpmToolchain(errors, setupAction, packageManifest) {
  const setupStep = asArray(setupAction.runs?.steps).find((step) =>
    step.uses?.startsWith("pnpm/action-setup@"),
  );
  const expectedPackageManager = `pnpm@${REQUIRED_PNPM_VERSION}`;
  const expectedEngine = `>=${REQUIRED_PNPM_VERSION} <12`;

  if (String(setupStep?.with?.version ?? "") !== REQUIRED_PNPM_VERSION) {
    errors.push(
      `setup-workspace must use bulk-capable pnpm ${REQUIRED_PNPM_VERSION}`,
    );
  }

  if (packageManifest?.packageManager !== expectedPackageManager) {
    errors.push(
      `packageManager must pin bulk-capable ${expectedPackageManager}`,
    );
  }

  if (packageManifest?.engines?.pnpm !== expectedEngine) {
    errors.push(`pnpm engine must be ${expectedEngine}`);
  }
}

function validateTestScripts(errors, packageManifest) {
  const expectedScripts = Object.freeze({
    "db:migrate:test": "node scripts/run-tests.mjs database",
    "test:all": "node scripts/run-tests.mjs all",
    "test:contract": "node scripts/run-tests.mjs contract",
    "test:e2e": "node scripts/run-tests.mjs e2e",
    "test:e2e:install:ci": "playwright install --with-deps chromium",
    "test:integration": "node scripts/run-tests.mjs integration",
    "test:reports:prepare": "node scripts/prepare-test-reports.mjs",
    "test:reports:verify": "node scripts/verify-test-reports.mjs",
    "test:security":
      "node scripts/run-tests.mjs security && node scripts/scan-secrets.mjs",
    "test:unit": "node scripts/run-tests.mjs unit",
  });

  for (const [name, expected] of Object.entries(expectedScripts)) {
    if (packageManifest?.scripts?.[name] !== expected) {
      errors.push(`test reports require exact package script: ${name}`);
    }
  }
}

function validateTestReports(errors, testsJob) {
  const steps = asArray(testsJob?.steps);
  const prepareCommand = `pnpm test:reports:prepare --required=${TEST_REPORT_LANES}`;
  const verifyCommand = `pnpm test:reports:verify --required=${TEST_REPORT_LANES}`;
  const prepareIndex = steps.findIndex(
    (step) =>
      step.name === "Prepare test reports" && step.run === prepareCommand,
  );
  const verifyIndex = steps.findIndex(
    (step) => step.name === "Verify test reports" && step.run === verifyCommand,
  );
  const uploadIndex = steps.findIndex(
    (step) => step.name === "Upload test reports",
  );
  const setupIndex = steps.findIndex((step) => step.name === "Setup workspace");
  const installBrowserIndex = steps.findIndex(
    (step) =>
      step.name === "Install Chromium" &&
      step.run === "pnpm test:e2e:install:ci",
  );
  const contractIndex = steps.findIndex(
    (step) =>
      step.name === "Contract tests" && step.run === "pnpm test:contract",
  );
  const browserTestsIndex = steps.findIndex(
    (step) => step.name === "Browser tests" && step.run === "pnpm test:e2e",
  );

  if (installBrowserIndex === -1 || browserTestsIndex === -1) {
    errors.push("browser harness requires exact install and test commands");
  } else if (
    setupIndex === -1 ||
    contractIndex === -1 ||
    !(
      setupIndex < installBrowserIndex &&
      installBrowserIndex < contractIndex &&
      contractIndex < browserTestsIndex &&
      browserTestsIndex < prepareIndex
    )
  ) {
    errors.push("browser harness steps are in an invalid order");
  }

  if (prepareIndex === -1) {
    errors.push("test reports missing exact prepare command");
  }
  if (verifyIndex === -1) {
    errors.push("test reports missing exact verification command");
  }
  if (uploadIndex === -1) {
    errors.push("test reports missing upload step");
    return;
  }
  if (
    prepareIndex === -1 ||
    verifyIndex === -1 ||
    !(prepareIndex < verifyIndex && verifyIndex < uploadIndex)
  ) {
    errors.push("test reports must be prepared and verified before upload");
  }

  const upload = steps[uploadIndex];
  if (upload.uses !== TEST_REPORT_UPLOAD_ACTION) {
    errors.push("test reports must use the approved pinned upload action");
  }
  if (upload.with?.name !== "dnd-ai-tests-${{ github.sha }}") {
    errors.push("test reports artifact name must bind to github.sha");
  }
  if (upload.with?.path !== "artifacts/testing") {
    errors.push("test reports artifact path must be artifacts/testing");
  }
  if (upload.with?.["if-no-files-found"] !== "error") {
    errors.push("test reports must fail when files are missing");
  }
  if (Number(upload.with?.["retention-days"]) !== 7) {
    errors.push("test reports retention must be exactly seven days");
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
    "pnpm docs:check",
    "pnpm boundaries:check",
    "pnpm ci:workflow:check",
    "pnpm deploy:check",
  ]);
  const qualityCheckout = asArray(jobs.quality?.steps).find((step) =>
    step.uses?.startsWith("actions/checkout@"),
  );
  if (Number(qualityCheckout?.with?.["fetch-depth"]) !== 2) {
    errors.push("quality checkout must use fetch-depth: 2");
  }
  const documentationCheckSteps = asArray(jobs.quality?.steps).filter(
    (step) => String(step.run ?? "").trim() === "pnpm docs:check",
  );
  if (
    documentationCheckSteps.length !== 1 ||
    documentationCheckSteps[0].env?.CONTRACT_BASE_REF !== "HEAD^1"
  ) {
    errors.push(
      "quality documentation check must use CONTRACT_BASE_REF=HEAD^1",
    );
  }
  for (const command of FORBIDDEN_QUALITY_COMMANDS) {
    if (
      asArray(jobs.quality?.steps).some((step) =>
        hasPnpmScriptInvocation(String(step.run ?? ""), command.script),
      )
    ) {
      errors.push(
        `quality must not duplicate legacy command: ${command.label}`,
      );
    }
  }
  requireCommands(errors, "tests", jobs.tests, [
    "pnpm test:e2e:install:ci",
    "pnpm test:unit",
    "pnpm test:integration",
    "pnpm db:migrate:test",
    "pnpm test:contract",
    "pnpm test:e2e",
  ]);
  validateTestReports(errors, jobs.tests);
  requireCommands(errors, "security", jobs.security, [
    "pnpm scan:sast",
    "pnpm test:security",
    "pnpm audit --audit-level=high",
  ]);
  const expectedAuditCommand = "pnpm audit --audit-level=high";
  const auditSteps = asArray(jobs.security?.steps).filter((step) =>
    String(step.run ?? "")
      .trim()
      .startsWith("pnpm audit"),
  );

  if (
    auditSteps.length !== 1 ||
    String(auditSteps[0].run ?? "").trim() !== expectedAuditCommand
  ) {
    errors.push(
      `security must use exact audit command: ${expectedAuditCommand}`,
    );
  }
  requireCommands(errors, "build", jobs.build, [
    "pnpm build",
    "pnpm artifact:prepare",
    "pnpm artifact:verify",
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

export function validateCiDocuments(
  workflow,
  setupAction,
  packageManifest = {},
) {
  const errors = [];
  validateTriggers(errors, workflow);
  validatePermissions(errors, workflow);
  validateSteps(errors, workflow, setupAction);
  validateSetupAction(errors, setupAction);
  validatePnpmToolchain(errors, setupAction, packageManifest);
  validateTestScripts(errors, packageManifest);
  validateJobs(errors, workflow);

  if (workflow.concurrency?.["cancel-in-progress"] !== true) {
    errors.push("workflow concurrency must cancel stale runs");
  }

  if (!workflow.concurrency?.group) {
    errors.push("workflow concurrency must define an isolation group");
  }

  return [...new Set(errors)].sort();
}
