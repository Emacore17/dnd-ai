import assert from "node:assert/strict";
import test from "node:test";

import {
  DeploymentSmokeError,
  deploymentTargetFromEnvironment,
  deploymentTargetFromGitHubEvent,
  smokeWebDeployment,
} from "../../scripts/lib/deployment-smoke.mjs";

const projectId = "prj_abcdefghijklmnopqrstuv";
const deploymentId = "dpl_abcdefghijklmnopqrstuvwxyz";
const commitSha = "a".repeat(40);
const oidcToken = "header.payload.signature";

function manifestFixture() {
  return {
    contractVersion: "staging-foundation-v1",
    provider: {
      name: "vercel",
      cliVersion: "55.0.0",
      project: {
        name: "dnd-ai-web",
        id: projectId,
        scopeSlug: "emacore17",
        stagingOrigin: "https://dnd-ai-web-git-main-emacore17.vercel.app",
        rootDirectory: "apps/web",
        framework: "nextjs",
      },
      regions: ["fra1"],
    },
    source: {
      repository: "Emacore17/dnd-ai",
      integration: "vercel-github-app",
      installationId: 12345678,
      autoDeploy: false,
      activationDeploymentPolicy: {
        "**": false,
        main: true,
        "release/production": false,
      },
      stagingBranch: "main",
      productionBranch: "release/production",
      forkProtection: true,
    },
    deploymentProtection: {
      mode: "standard",
      method: "vercel-authentication",
      trustedSource: {
        provider: "github-actions",
        issuer: "https://token.actions.githubusercontent.com",
        audience: "https://github.com/Emacore17",
        claims: {
          repository: "Emacore17/dnd-ai",
          repository_id: "1299266814",
          ref: "refs/heads/main",
          environment: "staging",
        },
        targetEnvironments: ["preview"],
      },
    },
    environments: {
      vercel: "preview",
      github: "staging",
      variables: [],
      secrets: [],
    },
    runtimes: { web: "active", api: "planned", worker: "planned" },
  };
}

function dispatchEvent(overrides = {}) {
  const event = {
    action: "vercel.deployment.ready",
    installation: { id: 12345678 },
    repository: { full_name: "Emacore17/dnd-ai" },
    client_payload: {
      url: "https://dnd-ai-web-git-main-emacore17.vercel.app",
      id: deploymentId,
      environment: "preview",
      project: { id: projectId, name: "dnd-ai-web" },
      git: { ref: "main", sha: commitSha, shortSha: "aaaaaaa" },
      state: { type: "success" },
    },
  };

  return {
    ...event,
    ...overrides,
    client_payload: {
      ...event.client_payload,
      ...(overrides.client_payload ?? {}),
    },
  };
}

function targetFixture() {
  return deploymentTargetFromGitHubEvent({
    event: dispatchEvent(),
    eventName: "repository_dispatch",
    manifest: manifestFixture(),
  });
}

function smokeOptions(overrides = {}) {
  return { oidcToken, ...overrides };
}

function healthPayload(overrides = {}) {
  return {
    contract: "web-health-v1",
    service: "web",
    status: "ok",
    deployment: {
      provider: "vercel",
      projectId,
      deploymentId,
      commitSha,
      gitRef: "main",
      repoOwner: "Emacore17",
      repoSlug: "dnd-ai",
      repoId: "1299266814",
      environment: "preview",
      region: "fra1",
      ...(overrides.deployment ?? {}),
    },
    ...overrides,
  };
}

function healthResponse(payload = healthPayload(), init = {}) {
  return new globalThis.Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
    ...init,
  });
}

test("a Vercel ready event becomes a normalized immutable smoke target", () => {
  const target = targetFixture();

  assert.equal(
    target.url.origin,
    manifestFixture().provider.project.stagingOrigin,
  );
  assert.equal(target.projectId, projectId);
  assert.equal(target.deploymentId, deploymentId);
  assert.equal(target.commitSha, commitSha);
  assert.equal(target.gitRef, "main");
  assert.equal(target.environment, "preview");
});

test("manual verification uses the same target validation", () => {
  const target = deploymentTargetFromEnvironment(
    {
      DEPLOYMENT_PROJECT_ID: projectId,
      DEPLOYMENT_ID: deploymentId,
      DEPLOYMENT_COMMIT_SHA: commitSha,
      DEPLOYMENT_ENVIRONMENT: "preview",
    },
    manifestFixture(),
  );

  assert.equal(target.projectName, "dnd-ai-web");
  assert.equal(target.gitRef, "main");
});

test("unlinked foundations and mismatched event identity fail closed", () => {
  const unlinked = manifestFixture();
  unlinked.provider.project.id = null;
  assert.throws(
    () =>
      deploymentTargetFromGitHubEvent({
        event: dispatchEvent(),
        eventName: "repository_dispatch",
        manifest: unlinked,
      }),
    (error) => error.code === "foundation_unlinked",
  );

  for (const [label, event, code] of [
    [
      "repository",
      dispatchEvent({ repository: { full_name: "attacker/repository" } }),
      "repository_mismatch",
    ],
    [
      "event",
      dispatchEvent({ action: "vercel.deployment.success" }),
      "event_type",
    ],
    [
      "installation",
      dispatchEvent({ installation: { id: 87654321 } }),
      "installation_mismatch",
    ],
    [
      "state",
      dispatchEvent({ client_payload: { state: { type: "ready" } } }),
      "event_state",
    ],
    [
      "project",
      dispatchEvent({
        client_payload: {
          project: { id: "prj_otherproject", name: "dnd-ai-web" },
        },
      }),
      "project_mismatch",
    ],
    [
      "commit",
      dispatchEvent({ client_payload: { git: { ref: "main", sha: "short" } } }),
      "commit_invalid",
    ],
    [
      "branch",
      dispatchEvent({
        client_payload: { git: { ref: "feature", sha: commitSha } },
      }),
      "branch_mismatch",
    ],
    [
      "environment",
      dispatchEvent({ client_payload: { environment: "production" } }),
      "environment_mismatch",
    ],
  ]) {
    assert.throws(
      () =>
        deploymentTargetFromGitHubEvent({
          event,
          eventName: "repository_dispatch",
          manifest: manifestFixture(),
        }),
      (error) => error.code === code,
      label,
    );
  }
});

test("the recorded staging origin rejects unsafe authority and foreign hosts", () => {
  const unsafeUrls = [
    "http://dnd-ai-web-test.vercel.app",
    "https://user:password@dnd-ai-web-test.vercel.app",
    "https://dnd-ai-web-test.vercel.app:8443",
    "https://dnd-ai-web-test.vercel.app/path",
    "https://dnd-ai-web-test.vercel.app/?token=never-print",
    "https://other-project.vercel.app",
    "https://dnd-ai-web-test.example.com",
    "https://dnd-ai-web-test-attacker.vercel.app",
  ];

  for (const url of unsafeUrls) {
    const manifest = manifestFixture();
    manifest.provider.project.stagingOrigin = url;
    assert.throws(
      () =>
        deploymentTargetFromGitHubEvent({
          event: dispatchEvent(),
          eventName: "repository_dispatch",
          manifest,
        }),
      DeploymentSmokeError,
      url,
    );
  }
});

test("an event URL is never used as the OIDC request destination", () => {
  const target = deploymentTargetFromGitHubEvent({
    event: dispatchEvent({
      client_payload: { url: "https://attacker.example/collect" },
    }),
    eventName: "repository_dispatch",
    manifest: manifestFixture(),
  });

  assert.equal(
    target.url.origin,
    "https://dnd-ai-web-git-main-emacore17.vercel.app",
  );
});

test("remote health verifies contract, deployment identity and redacted output", async () => {
  let requestedUrl;
  let requestOptions;
  const report = await smokeWebDeployment(
    targetFixture(),
    manifestFixture(),
    smokeOptions({
      fetchImpl: async (url, options) => {
        requestedUrl = url;
        requestOptions = options;
        return healthResponse();
      },
    }),
  );

  assert.equal(requestedUrl.pathname, "/health");
  assert.equal(requestOptions.redirect, "manual");
  assert.equal(requestOptions.headers.accept, "application/json");
  assert.equal(
    requestOptions.headers["x-vercel-trusted-oidc-idp-token"],
    oidcToken,
  );
  assert.equal(report.status, "passed");
  assert.equal(report.region, "fra1");
  assert.equal(report.commit, commitSha.slice(0, 12));
  assert.doesNotMatch(JSON.stringify(report), new RegExp(projectId));
  assert.doesNotMatch(JSON.stringify(report), new RegExp(deploymentId));
  assert.doesNotMatch(JSON.stringify(report), /emacore17/i);
  assert.doesNotMatch(JSON.stringify(report), new RegExp(oidcToken));
});

test("missing or malformed OIDC access fails before any remote request", async () => {
  for (const token of [undefined, "", "not-a-jwt", "a.b.c\r\nmalicious"]) {
    let fetchCalled = false;
    await assert.rejects(
      smokeWebDeployment(targetFixture(), manifestFixture(), {
        fetchImpl: async () => {
          fetchCalled = true;
          return healthResponse();
        },
        oidcToken: token,
      }),
      (error) => error.code === "oidc_token_invalid",
    );
    assert.equal(fetchCalled, false);
  }
});

test("runtime Git identity must match the trusted repository and staging branch", async () => {
  for (const deployment of [
    { gitRef: "feature" },
    { repoOwner: "attacker" },
    { repoSlug: "lookalike" },
    { repoId: "999999999" },
  ]) {
    await assert.rejects(
      smokeWebDeployment(
        targetFixture(),
        manifestFixture(),
        smokeOptions({
          fetchImpl: async () => healthResponse(healthPayload({ deployment })),
        }),
      ),
      (error) => error.code === "health_identity",
    );
  }
});

test("HTTP, content and cache failures never inspect or print a remote body", async () => {
  const secretBody = "remote-secret-body-must-stay-redacted";
  const cases = [
    [
      "status",
      new globalThis.Response(secretBody, {
        status: 503,
        headers: { "content-type": "text/plain", "cache-control": "no-store" },
      }),
      "http_status",
    ],
    [
      "content type",
      new globalThis.Response(secretBody, {
        status: 200,
        headers: { "content-type": "text/plain", "cache-control": "no-store" },
      }),
      "content_type",
    ],
    [
      "lookalike content type",
      new globalThis.Response(secretBody, {
        status: 200,
        headers: {
          "content-type": "application/jsonp",
          "cache-control": "no-store",
        },
      }),
      "content_type",
    ],
    [
      "cache",
      new globalThis.Response(JSON.stringify(healthPayload()), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
      "cache_policy",
    ],
    [
      "lookalike cache directive",
      new globalThis.Response(JSON.stringify(healthPayload()), {
        status: 200,
        headers: {
          "cache-control": "x-no-store",
          "content-type": "application/json",
        },
      }),
      "cache_policy",
    ],
  ];

  for (const [label, response, code] of cases) {
    await assert.rejects(
      smokeWebDeployment(
        targetFixture(),
        manifestFixture(),
        smokeOptions({
          fetchImpl: async () => response,
        }),
      ),
      (error) => {
        assert.equal(error.code, code, label);
        assert.doesNotMatch(error.message, new RegExp(secretBody));
        return true;
      },
    );
  }
});

test("health identity mismatches, oversized bodies and invalid JSON fail closed", async () => {
  const cases = [
    [
      healthResponse(healthPayload({ deployment: { region: "iad1" } })),
      "health_identity",
    ],
    [
      healthResponse(healthPayload(), {
        headers: {
          "cache-control": "no-store",
          "content-length": "9000",
          "content-type": "application/json",
        },
      }),
      "response_size",
    ],
    [
      new globalThis.Response("not-json", {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "content-type": "application/json",
        },
      }),
      "response_json",
    ],
  ];

  for (const [response, code] of cases) {
    await assert.rejects(
      smokeWebDeployment(
        targetFixture(),
        manifestFixture(),
        smokeOptions({
          fetchImpl: async () => response,
        }),
      ),
      (error) => error.code === code,
    );
  }
});

test("oversized streaming bodies are cancelled before an unbounded text read", async () => {
  let cancelled = false;
  let textCalled = false;
  const oversizedChunk = new Uint8Array(9_000);
  const response = {
    status: 200,
    headers: new globalThis.Headers({
      "cache-control": "no-store",
      "content-type": "application/json",
    }),
    body: {
      getReader() {
        return {
          async read() {
            return { done: false, value: oversizedChunk };
          },
          async cancel() {
            cancelled = true;
          },
          releaseLock() {},
        };
      },
    },
    async text() {
      textCalled = true;
      return "x".repeat(9_000);
    },
  };

  await assert.rejects(
    smokeWebDeployment(
      targetFixture(),
      manifestFixture(),
      smokeOptions({
        fetchImpl: async () => response,
      }),
    ),
    (error) => error.code === "response_size",
  );
  assert.equal(textCalled, false);
  assert.equal(cancelled, true);
});

test("network failures and timeouts have stable redacted errors", async () => {
  for (const [name, code] of [
    ["TypeError", "request_failed"],
    ["TimeoutError", "request_timeout"],
  ]) {
    await assert.rejects(
      smokeWebDeployment(
        targetFixture(),
        manifestFixture(),
        smokeOptions({
          fetchImpl: async () => {
            const error = new Error("provider details must not escape");
            error.name = name;
            throw error;
          },
        }),
      ),
      (error) => {
        assert.equal(error.code, code);
        assert.doesNotMatch(error.message, /provider details/);
        return true;
      },
    );
  }
});
