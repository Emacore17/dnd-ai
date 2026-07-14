const ACTION_PIN_PATTERN =
  // The bounded character classes contain no ambiguous backtracking path.
  // eslint-disable-next-line security/detect-unsafe-regex
  /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_./-]+)?@[a-f0-9]{40}$/;
const CHECKOUT_ACTION =
  "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0";
const SETUP_NODE_ACTION =
  "actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e";
const GITHUB_SCRIPT_ACTION =
  "actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3";
const OIDC_SCRIPT = [
  "const token = await core.getIDToken();",
  "core.setSecret(token);",
  'core.setOutput("token", token);',
].join("\n");
const SMOKE_CONDITION =
  "(github.event_name == 'workflow_dispatch' && " +
  "github.ref == 'refs/heads/main') || " +
  "(github.event_name == 'repository_dispatch' && " +
  "github.event.client_payload.project.name == 'dnd-ai-web' && " +
  "github.event.client_payload.git.ref == 'main' && " +
  "github.event.client_payload.environment == 'preview' && " +
  "github.event.client_payload.state.type == 'success')";
const CONCURRENCY_GROUP = "staging-smoke-dnd-ai-web-main";

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  return value === undefined ? [] : [value];
}

function hasKey(value, key) {
  return value && Object.prototype.hasOwnProperty.call(value, key);
}

function expectOnlyKeys(errors, label, value, expectedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} must be an object`);
    return;
  }

  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(`${label} must contain only ${expected.join(", ")}`);
  }
}

function exactJson(value, expected) {
  return JSON.stringify(value) === JSON.stringify(expected);
}

function workflowText(workflow) {
  return JSON.stringify(workflow ?? {});
}

export function validateDeploymentWorkflow(workflow) {
  const errors = [];
  const triggers = workflow?.on ?? {};
  const permissions = workflow?.permissions ?? {};
  const smoke = workflow?.jobs?.smoke ?? {};
  const steps = asArray(smoke.steps);
  const source = workflowText(workflow);

  expectOnlyKeys(errors, "deployment workflow", workflow, [
    "concurrency",
    "jobs",
    "name",
    "on",
    "permissions",
  ]);
  expectOnlyKeys(errors, "deployment workflow triggers", triggers, [
    "repository_dispatch",
    "workflow_dispatch",
  ]);
  expectOnlyKeys(errors, "deployment smoke job", smoke, [
    "environment",
    "if",
    "name",
    "runs-on",
    "steps",
    "timeout-minutes",
  ]);

  if (
    !workflow?.jobs ||
    JSON.stringify(Object.keys(workflow.jobs).sort()) !==
      JSON.stringify(["smoke"])
  ) {
    errors.push("deployment workflow must contain only the smoke job");
  }

  for (const forbiddenTrigger of [
    "pull_request_target",
    "pull_request",
    "push",
  ]) {
    if (hasKey(triggers, forbiddenTrigger)) {
      errors.push(`${forbiddenTrigger} is forbidden for deployment smoke`);
    }
  }
  if (!hasKey(triggers, "repository_dispatch")) {
    errors.push("deployment smoke must use repository_dispatch");
  }
  if (!hasKey(triggers, "workflow_dispatch")) {
    errors.push("deployment smoke must expose a manual verification trigger");
  }
  const dispatchTypes = asArray(triggers.repository_dispatch?.types);
  if (
    dispatchTypes.length !== 1 ||
    dispatchTypes[0] !== "vercel.deployment.ready"
  ) {
    errors.push("repository_dispatch must accept only vercel.deployment.ready");
  }
  expectOnlyKeys(
    errors,
    "repository_dispatch trigger",
    triggers.repository_dispatch,
    ["types"],
  );
  expectOnlyKeys(
    errors,
    "workflow_dispatch trigger",
    triggers.workflow_dispatch,
    ["inputs"],
  );
  const manualInputs = triggers.workflow_dispatch?.inputs;
  expectOnlyKeys(errors, "workflow_dispatch inputs", manualInputs, [
    "commit_sha",
    "deployment_id",
    "environment",
    "project_id",
  ]);
  for (const inputName of ["commit_sha", "deployment_id", "project_id"]) {
    const input = manualInputs?.[inputName];
    if (input?.required !== true || input?.type !== "string") {
      errors.push(`${inputName} must be a required string input`);
    }
  }
  const environmentInput = manualInputs?.environment;
  if (
    environmentInput?.required !== true ||
    environmentInput?.type !== "choice" ||
    environmentInput?.default !== "preview" ||
    !exactJson(environmentInput?.options, ["preview"])
  ) {
    errors.push("manual deployment environment must be preview only");
  }

  if (!exactJson(permissions, { contents: "read", "id-token": "write" })) {
    errors.push(
      "deployment workflow permissions must be exactly contents: read and id-token: write",
    );
  }

  if (!workflow?.jobs?.smoke) {
    errors.push("deployment workflow must define the smoke job");
  }
  if (smoke.name !== "Staging / Smoke") {
    errors.push("smoke job must keep the stable name Staging / Smoke");
  }
  if (smoke["runs-on"] !== "ubuntu-24.04") {
    errors.push("smoke job must use an ephemeral ubuntu-24.04 runner");
  }
  if (
    !Number.isInteger(smoke["timeout-minutes"]) ||
    smoke["timeout-minutes"] < 1 ||
    smoke["timeout-minutes"] > 10
  ) {
    errors.push("smoke timeout must be between one and ten minutes");
  }
  if (smoke["continue-on-error"] === true) {
    errors.push("smoke job must propagate failures");
  }
  if (smoke.permissions !== undefined) {
    errors.push("smoke job must not override job-level permissions");
  }
  if (smoke.environment?.name !== "staging") {
    errors.push("smoke job must use the protected staging environment");
  }
  if (!exactJson(smoke.environment, { name: "staging" })) {
    errors.push("staging environment must not publish an unvalidated URL");
  }

  if (smoke.if !== SMOKE_CONDITION) {
    errors.push(
      "smoke condition must exactly constrain event, project, branch, preview and successful state",
    );
  }

  if (workflow?.concurrency?.["cancel-in-progress"] !== true) {
    errors.push("deployment concurrency must cancel stale smoke runs");
  }
  if (!workflow?.concurrency?.group) {
    errors.push("deployment concurrency must define an isolation group");
  }
  expectOnlyKeys(errors, "deployment concurrency", workflow?.concurrency, [
    "cancel-in-progress",
    "group",
  ]);
  if (workflow?.concurrency?.group !== CONCURRENCY_GROUP) {
    errors.push("deployment concurrency group must keep deployment isolation");
  }

  const expectedSteps = [
    {
      name: "Checkout trusted smoke verifier",
      uses: CHECKOUT_ACTION,
      with: { ref: "main", "persist-credentials": false },
    },
    {
      name: "Setup Node.js",
      uses: SETUP_NODE_ACTION,
      with: { "node-version-file": ".node-version" },
    },
    {
      name: "Request short-lived deployment access",
      id: "oidc",
      uses: GITHUB_SCRIPT_ACTION,
      with: { script: `${OIDC_SCRIPT}\n` },
    },
    {
      name: "Verify deployment identity and health",
      env: {
        VERCEL_TRUSTED_OIDC_TOKEN: "${{ steps.oidc.outputs.token }}",
      },
      run: "node scripts/smoke-web-deployment.mjs",
    },
  ];
  if (!exactJson(steps, expectedSteps)) {
    errors.push(
      "deployment workflow steps must match the closed trusted smoke sequence",
    );
  }

  for (const [index, step] of steps.entries()) {
    if (step["continue-on-error"] === true) {
      errors.push(`smoke step ${index} must propagate failures`);
    }
    if (step.uses && !ACTION_PIN_PATTERN.test(step.uses)) {
      errors.push(`smoke step ${index} uses an unpinned action`);
    }
    if (step.uses?.startsWith("actions/checkout@")) {
      if (![false, "false"].includes(step.with?.["persist-credentials"])) {
        errors.push("deployment checkout must disable persisted credentials");
      }
      if (step.with?.ref !== "main") {
        errors.push("deployment smoke must checkout trusted main");
      }
    }
    if (/\$\{\{\s*github\.event\./.test(step.run ?? "")) {
      errors.push("event payload must never be interpolated into run commands");
    }
  }

  for (const forbiddenSource of [
    "pull_request_target",
    "secrets.",
    "VERCEL_TOKEN",
    "vercel deploy",
    "--prod",
    "vercel promote",
  ]) {
    if (source.includes(forbiddenSource)) {
      errors.push(
        `deployment workflow contains forbidden source: ${forbiddenSource}`,
      );
    }
  }

  return [...new Set(errors)].sort();
}
