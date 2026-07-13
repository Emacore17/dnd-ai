import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("the standalone launcher resolves only the packaged pnpm hoist", async (context) => {
  const artifactRoot = await mkdtemp(
    path.join(os.tmpdir(), "dnd-ai-artifact-runtime-"),
  );
  context.after(() => rm(artifactRoot, { force: true, recursive: true }));

  await mkdir(path.join(artifactRoot, "apps", "web"), { recursive: true });
  await mkdir(
    path.join(
      artifactRoot,
      "node_modules",
      ".pnpm",
      "node_modules",
      "artifact-smoke-dependency",
    ),
    { recursive: true },
  );
  await copyFile(
    path.resolve("apps/web/artifact-runtime/start.mjs"),
    path.join(artifactRoot, "start.mjs"),
  );
  await writeFile(
    path.join(artifactRoot, "apps", "web", "server.js"),
    "console.log(require('artifact-smoke-dependency'));\n",
    "utf8",
  );
  await writeFile(
    path.join(
      artifactRoot,
      "node_modules",
      ".pnpm",
      "node_modules",
      "artifact-smoke-dependency",
      "index.js",
    ),
    "module.exports = 'artifact-runtime-ready';\n",
    "utf8",
  );

  const { stdout } = await execFileAsync(
    process.execPath,
    [path.join(artifactRoot, "start.mjs")],
    {
      cwd: artifactRoot,
      env: { ...process.env, NODE_PATH: "" },
      timeout: 5_000,
    },
  );

  assert.equal(stdout.trim(), "artifact-runtime-ready");
});
