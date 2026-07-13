import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  scanRepositoryFiles,
  scanSecretText,
} from "../../scripts/lib/secret-scanner.mjs";

const execFileAsync = promisify(execFile);

test("private environment files fail closed by path even without a known token format", () => {
  assert.deepEqual(
    scanSecretText(
      "DATABASE_PASSWORD=a-generic-password\n",
      "apps/api/.env.local",
    ),
    [{ filePath: "apps/api/.env.local", line: 1, ruleId: "environment-file" }],
  );
  assert.deepEqual(
    scanSecretText("APP_ENV=local\n", "apps/api/.env.example"),
    [],
  );
});

test("a force-tracked private environment file is rejected by the repository scan", async (context) => {
  const repositoryRoot = await mkdtemp(
    path.join(tmpdir(), "dnd-ai-env-policy-"),
  );
  context.after(() => rm(repositoryRoot, { force: true, recursive: true }));

  await execFileAsync("git", ["init", "--quiet"], { cwd: repositoryRoot });
  await writeFile(
    path.join(repositoryRoot, ".gitignore"),
    ".env\n.env.*\n!.env.example\n",
  );
  await writeFile(
    path.join(repositoryRoot, ".env.local"),
    "PASSWORD=generic\n",
  );
  await execFileAsync("git", ["add", ".gitignore"], { cwd: repositoryRoot });
  await execFileAsync("git", ["add", "--force", ".env.local"], {
    cwd: repositoryRoot,
  });

  assert.deepEqual(await scanRepositoryFiles(repositoryRoot), [
    { filePath: ".env.local", line: 1, ruleId: "environment-file" },
  ]);
});

test("a private environment symlink is classified by path without reading its target", async (context) => {
  const repositoryRoot = await mkdtemp(
    path.join(tmpdir(), "dnd-ai-env-symlink-policy-"),
  );
  const externalRoot = await mkdtemp(
    path.join(tmpdir(), "dnd-ai-env-symlink-target-"),
  );
  context.after(() => rm(repositoryRoot, { force: true, recursive: true }));
  context.after(() => rm(externalRoot, { force: true, recursive: true }));

  await execFileAsync("git", ["init", "--quiet"], { cwd: repositoryRoot });
  await writeFile(
    path.join(repositoryRoot, ".gitignore"),
    ".env\n.env.*\n!.env.example\n",
  );
  const targetPath = path.join(externalRoot, "missing.env");

  try {
    await symlink(targetPath, path.join(repositoryRoot, ".env.local"));
  } catch (error) {
    if (error.code === "EPERM" || error.code === "EACCES") {
      context.skip("symlink creation is not permitted on this Windows host");
      return;
    }

    throw error;
  }

  await execFileAsync("git", ["add", ".gitignore"], { cwd: repositoryRoot });
  await execFileAsync("git", ["add", "--force", ".env.local"], {
    cwd: repositoryRoot,
  });

  assert.deepEqual(await scanRepositoryFiles(repositoryRoot), [
    { filePath: ".env.local", line: 1, ruleId: "environment-file" },
  ]);
});
