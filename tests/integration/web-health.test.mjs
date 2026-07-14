import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const webServerPath = path.join(
  repositoryRoot,
  "apps",
  "web",
  ".next",
  "standalone",
  "apps",
  "web",
  "server.js",
);

async function reserveAvailablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return address.port;
}

async function waitForHealth(origin, child, output) {
  const deadline = Date.now() + 8_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`web server exited before health check: ${output()}`);
    }
    try {
      const response = await globalThis.fetch(`${origin}/health`);
      if (response.status === 200) {
        return response;
      }
    } catch {
      // The bounded poll expects connection refusal until Next finishes binding.
    }
    await delay(50);
  }

  throw new Error(`web health endpoint did not become ready: ${output()}`);
}

test("the standalone web runtime exposes deployment identity without caching", async (context) => {
  const port = await reserveAvailablePort();
  const projectId = "prj_integrationfixture";
  const deploymentId = "dpl_integrationfixture";
  const commitSha = "b".repeat(40);
  const child = spawn(process.execPath, [webServerPath], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      VERCEL: "1",
      VERCEL_PROJECT_ID: projectId,
      VERCEL_DEPLOYMENT_ID: deploymentId,
      VERCEL_GIT_COMMIT_SHA: commitSha,
      VERCEL_GIT_COMMIT_REF: "main",
      VERCEL_GIT_REPO_OWNER: "Emacore17",
      VERCEL_GIT_REPO_SLUG: "dnd-ai",
      VERCEL_GIT_REPO_ID: "1299266814",
      VERCEL_ENV: "preview",
      VERCEL_REGION: "fra1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout = `${stdout}${chunk}`.slice(-4_096);
  });
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-4_096);
  });
  context.after(async () => {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once("exit", resolve));
    }
  });

  const response = await waitForHealth(`http://127.0.0.1:${port}`, child, () =>
    `${stdout}\n${stderr}`.trim(),
  );
  assert.match(
    response.headers.get("content-type") ?? "",
    /^application\/json/,
  );
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.deepEqual(await response.json(), {
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
    },
  });
});
