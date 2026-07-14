import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

import {
  DeploymentSmokeError,
  deploymentTargetFromEnvironment,
  deploymentTargetFromGitHubEvent,
  smokeWebDeployment,
} from "./lib/deployment-smoke.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = path.join(
  repositoryRoot,
  "infra",
  "deployment",
  "vercel-staging.json",
);

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function main() {
  const manifest = await readJson(manifestPath);
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const target = eventPath
    ? deploymentTargetFromGitHubEvent({
        event: await readJson(eventPath),
        eventName: process.env.GITHUB_EVENT_NAME,
        manifest,
      })
    : deploymentTargetFromEnvironment(process.env, manifest);
  const report = await smokeWebDeployment(target, manifest, {
    oidcToken: process.env.VERCEL_TRUSTED_OIDC_TOKEN,
  });
  console.log(JSON.stringify(report));
}

try {
  await main();
} catch (error) {
  if (error instanceof DeploymentSmokeError) {
    console.error(
      JSON.stringify({
        status: "failed",
        code: error.code,
        message: error.message,
      }),
    );
    process.exitCode = 1;
  } else {
    console.error(
      JSON.stringify({
        status: "failed",
        code: "unexpected_error",
        message: "deployment smoke failed unexpectedly",
      }),
    );
    process.exitCode = 1;
  }
}
