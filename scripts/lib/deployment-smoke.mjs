import { Buffer } from "node:buffer";
import { URL } from "node:url";

import {
  redactDeploymentOrigin,
  redactIdentifier,
  validateDeploymentManifest,
} from "./deployment-foundation.mjs";

const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const DEPLOYMENT_ID_PATTERN = /^dpl_[A-Za-z0-9]+$/;
const PROJECT_ID_PATTERN = /^prj_[A-Za-z0-9]+$/;
const OIDC_TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MAX_OIDC_TOKEN_BYTES = 8_192;
const MAX_RESPONSE_BYTES = 8_192;

export class DeploymentSmokeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DeploymentSmokeError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new DeploymentSmokeError(code, message);
}

function requiredString(value, code, field) {
  if (typeof value !== "string" || value.length === 0) {
    fail(code, `${field} is required`);
  }

  return value;
}

function validateProjectIdentity(target, manifest) {
  const expectedProject = manifest.provider.project;

  if (target.projectName !== expectedProject.name) {
    fail("project_mismatch", "deployment project name does not match manifest");
  }
  if (!PROJECT_ID_PATTERN.test(target.projectId)) {
    fail("project_id_invalid", "deployment project ID is malformed");
  }
  if (target.projectId !== expectedProject.id) {
    fail("project_mismatch", "deployment project ID does not match manifest");
  }
  if (!DEPLOYMENT_ID_PATTERN.test(target.deploymentId)) {
    fail("deployment_id_invalid", "deployment ID is malformed");
  }
}

function validateGitIdentity(target, manifest) {
  if (!COMMIT_SHA_PATTERN.test(target.commitSha)) {
    fail("commit_invalid", "deployment commit SHA is malformed");
  }
  if (target.gitRef !== manifest.source.stagingBranch) {
    fail("branch_mismatch", "deployment branch is not the staging branch");
  }
  if (target.environment !== manifest.environments.vercel) {
    fail(
      "environment_mismatch",
      "deployment environment does not match manifest",
    );
  }
}

function validateDeploymentUrl(value, projectName, scopeSlug) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("url_invalid", "deployment URL is invalid");
  }

  if (url.protocol !== "https:") {
    fail("url_protocol", "deployment URL must use HTTPS");
  }
  if (url.username || url.password || url.port) {
    fail(
      "url_authority",
      "deployment URL must not contain credentials or a port",
    );
  }
  if (url.search || url.hash) {
    fail(
      "url_components",
      "deployment URL must not contain a query or fragment",
    );
  }
  if (url.pathname !== "/") {
    fail("url_path", "deployment URL must identify the deployment origin");
  }

  const expectedSuffix = `-${scopeSlug}.vercel.app`;
  const expectedPrefix = `${projectName}-`;
  if (
    !url.hostname.endsWith(expectedSuffix) ||
    !url.hostname.startsWith(expectedPrefix)
  ) {
    fail("url_host", "deployment URL is outside the linked Vercel scope");
  }

  return url;
}

export function deploymentTargetFromGitHubEvent({
  event,
  eventName,
  manifest,
}) {
  const manifestErrors = validateDeploymentManifest(manifest, {
    requireLinked: true,
  });
  if (manifestErrors.length > 0) {
    fail(
      "foundation_unlinked",
      "deployment foundation is not linked to a project",
    );
  }

  if (event?.repository?.full_name !== manifest.source.repository) {
    fail(
      "repository_mismatch",
      "deployment event repository does not match manifest",
    );
  }

  let payload;
  if (eventName === "repository_dispatch") {
    if (event?.action !== "vercel.deployment.ready") {
      fail("event_type", "deployment event is not a Vercel ready event");
    }
    if (event?.installation?.id !== manifest.source.installationId) {
      fail(
        "installation_mismatch",
        "deployment event does not match the trusted GitHub App installation",
      );
    }
    payload = event?.client_payload;
    if (payload?.state?.type !== "success") {
      fail("event_state", "deployment event state is not successful");
    }
  } else if (eventName === "workflow_dispatch") {
    const inputs = event?.inputs ?? {};
    payload = {
      id: inputs.deployment_id,
      environment: inputs.environment,
      project: {
        id: inputs.project_id,
        name: manifest.provider.project.name,
      },
      git: {
        ref: manifest.source.stagingBranch,
        sha: inputs.commit_sha,
      },
    };
  } else {
    fail("event_name", "unsupported deployment verification event");
  }

  const target = {
    url: requiredString(
      manifest.provider.project.stagingOrigin,
      "url_missing",
      "trusted staging origin",
    ),
    projectId: requiredString(
      payload?.project?.id,
      "project_id_missing",
      "project ID",
    ),
    projectName: requiredString(
      payload?.project?.name,
      "project_name_missing",
      "project name",
    ),
    deploymentId: requiredString(
      payload?.id,
      "deployment_id_missing",
      "deployment ID",
    ),
    commitSha: requiredString(
      payload?.git?.sha,
      "commit_missing",
      "commit SHA",
    ).toLowerCase(),
    gitRef: requiredString(payload?.git?.ref, "branch_missing", "Git ref"),
    environment: requiredString(
      payload?.environment,
      "environment_missing",
      "environment",
    ),
  };

  validateProjectIdentity(target, manifest);
  validateGitIdentity(target, manifest);
  const url = validateDeploymentUrl(
    target.url,
    target.projectName,
    manifest.provider.project.scopeSlug,
  );

  return { ...target, url };
}

export function deploymentTargetFromEnvironment(environment, manifest) {
  return deploymentTargetFromGitHubEvent({
    eventName: "workflow_dispatch",
    manifest,
    event: {
      repository: { full_name: manifest.source.repository },
      inputs: {
        project_id: environment.DEPLOYMENT_PROJECT_ID,
        deployment_id: environment.DEPLOYMENT_ID,
        commit_sha: environment.DEPLOYMENT_COMMIT_SHA,
        environment: environment.DEPLOYMENT_ENVIRONMENT ?? "preview",
      },
    },
  });
}

function validateHealthPayload(payload, target, manifest) {
  if (
    payload?.contract !== "web-health-v1" ||
    payload?.service !== "web" ||
    payload?.status !== "ok"
  ) {
    fail("health_contract", "health response does not satisfy web-health-v1");
  }

  const deployment = payload?.deployment;
  const [repoOwner, repoSlug] = manifest.source.repository.split("/");
  const expected = {
    provider: "vercel",
    projectId: target.projectId,
    deploymentId: target.deploymentId,
    commitSha: target.commitSha,
    gitRef: target.gitRef,
    repoOwner,
    repoSlug,
    repoId: manifest.deploymentProtection.trustedSource.claims.repository_id,
    environment: target.environment,
    region: manifest.provider.regions[0],
  };

  for (const [key, expectedValue] of Object.entries(expected)) {
    if (deployment?.[key] !== expectedValue) {
      fail("health_identity", `health deployment ${key} does not match`);
    }
  }
}

export function validateTrustedOidcToken(value) {
  if (
    typeof value !== "string" ||
    Buffer.byteLength(value, "utf8") > MAX_OIDC_TOKEN_BYTES ||
    !OIDC_TOKEN_PATTERN.test(value)
  ) {
    fail(
      "oidc_token_invalid",
      "a valid short-lived deployment access token is required",
    );
  }

  return value;
}

async function readBoundedBody(response) {
  const reader = response.body?.getReader?.();
  if (!reader) {
    fail("response_body", "deployment health response has no readable body");
  }

  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!(value instanceof Uint8Array)) {
        fail("response_body", "deployment health response body is invalid");
      }

      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        fail(
          "response_size",
          "deployment health response exceeds the size limit",
        );
      }
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    if (error instanceof DeploymentSmokeError) {
      throw error;
    }
    fail("response_read", "deployment health response could not be read");
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, size).toString("utf8");
}

export async function smokeWebDeployment(
  target,
  manifest,
  { fetchImpl = globalThis.fetch, oidcToken, timeoutMs = 10_000 } = {},
) {
  const trustedOidcToken = validateTrustedOidcToken(oidcToken);
  const healthUrl = new URL("/health", target.url);
  let response;
  try {
    response = await fetchImpl(healthUrl, {
      headers: {
        accept: "application/json",
        "x-vercel-trusted-oidc-idp-token": trustedOidcToken,
      },
      redirect: "manual",
      signal: globalThis.AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      fail("request_timeout", "deployment health request timed out");
    }
    fail("request_failed", "deployment health request failed");
  }

  if (response.status !== 200) {
    fail("http_status", "deployment health endpoint did not return HTTP 200");
  }
  const contentType = response.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    fail("content_type", "deployment health endpoint did not return JSON");
  }
  const cacheControl = response.headers.get("cache-control") ?? "";
  const cacheDirectives = cacheControl
    .split(",")
    .map((directive) => directive.trim().split("=", 1)[0].toLowerCase());
  if (!cacheDirectives.includes("no-store")) {
    fail("cache_policy", "deployment health endpoint must disable caching");
  }
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    fail("response_size", "deployment health response exceeds the size limit");
  }

  const body = await readBoundedBody(response);

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    fail("response_json", "deployment health response contains invalid JSON");
  }
  validateHealthPayload(payload, target, manifest);

  return {
    status: "passed",
    contract: payload.contract,
    service: payload.service,
    environment: target.environment,
    region: manifest.provider.regions[0],
    commit: target.commitSha.slice(0, 12),
    projectId: redactIdentifier(target.projectId),
    deploymentId: redactIdentifier(target.deploymentId),
    origin: redactDeploymentOrigin(target.projectName),
  };
}
