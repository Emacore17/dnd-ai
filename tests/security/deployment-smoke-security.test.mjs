import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import { validateTrustedOidcToken } from "../../scripts/lib/deployment-smoke.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const smokeCli = path.join(
  repositoryRoot,
  "scripts",
  "smoke-web-deployment.mjs",
);

function cleanDeploymentEnvironment(overrides = {}) {
  const environment = { ...process.env };
  for (const key of [
    "DEPLOYMENT_PROJECT_ID",
    "DEPLOYMENT_ID",
    "DEPLOYMENT_COMMIT_SHA",
    "DEPLOYMENT_ENVIRONMENT",
    "GITHUB_EVENT_NAME",
    "GITHUB_EVENT_PATH",
    "VERCEL_TRUSTED_OIDC_TOKEN",
  ]) {
    delete environment[key];
  }
  return { ...environment, ...overrides };
}

test("deployment smoke refuses missing provider metadata with a stable safe exit", () => {
  const result = spawnSync(process.execPath, [smokeCli], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: cleanDeploymentEnvironment(),
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /"status":"failed"/);
  assert.match(
    result.stderr,
    /foundation_unlinked|project_id_missing|url_missing/,
  );
  assert.equal(result.stdout, "");
});

test("malformed OIDC content is rejected without reflecting it", () => {
  const sensitiveValue = "header.payload.signature\r\nmust-never-appear";

  assert.throws(
    () => validateTrustedOidcToken(sensitiveValue),
    (error) => {
      assert.equal(error.code, "oidc_token_invalid");
      assert.doesNotMatch(error.message, /must-never-appear/);
      assert.doesNotMatch(error.message, /header\.payload/);
      return true;
    },
  );
});
