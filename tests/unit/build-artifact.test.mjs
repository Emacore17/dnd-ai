import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  prepareBuildArtifact,
  verifyBuildArtifact,
} from "../../scripts/lib/build-artifact.mjs";

async function createFixture() {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), "dnd-ai-artifact-"),
  );
  const sourceDirectory = path.join(repositoryRoot, "build", "api");
  await mkdir(sourceDirectory, { recursive: true });
  await writeFile(
    path.join(sourceDirectory, "server.js"),
    "export {};\n",
    "utf8",
  );

  return {
    repositoryRoot,
    outputDirectory: path.join(repositoryRoot, "artifacts", "bl002"),
    sourceRoots: [{ source: "build/api", target: "api" }],
  };
}

async function createDirectoryLinkOrSkip(context, targetPath, linkPath) {
  try {
    await symlink(
      targetPath,
      linkPath,
      process.platform === "win32" ? "junction" : "dir",
    );
    return true;
  } catch (error) {
    if (["EPERM", "EACCES"].includes(error.code)) {
      context.skip("directory links are not permitted on this host");
      return false;
    }

    throw error;
  }
}

test("a build artifact is allowlisted, hashed and reproducible", async () => {
  const fixture = await createFixture();
  const manifest = await prepareBuildArtifact(fixture);

  assert.equal(manifest.schemaVersion, "build-artifact-v1");
  assert.deepEqual(
    manifest.files.map(({ path: filePath }) => filePath),
    ["api/server.js"],
  );
  assert.deepEqual(await verifyBuildArtifact(fixture), []);

  const persistedManifest = JSON.parse(
    await readFile(path.join(fixture.outputDirectory, "manifest.json"), "utf8"),
  );
  assert.deepEqual(persistedManifest, manifest);
});

test("missing source roots and output traversal fail closed", async () => {
  const fixture = await createFixture();

  await assert.rejects(
    prepareBuildArtifact({
      ...fixture,
      sourceRoots: [{ source: "missing", target: "api" }],
    }),
    /required build output is missing/,
  );
  await assert.rejects(
    prepareBuildArtifact({
      ...fixture,
      outputDirectory: path.join(fixture.repositoryRoot, "..", "outside"),
    }),
    /artifact output must stay inside artifacts/,
  );
});

test("forbidden and unexpected hidden output names are rejected", async () => {
  const fixture = await createFixture();
  const sourceDirectory = path.join(fixture.repositoryRoot, "build", "api");
  await writeFile(
    path.join(sourceDirectory, ".env"),
    "VALUE=fixture\n",
    "utf8",
  );

  await assert.rejects(
    prepareBuildArtifact(fixture),
    /forbidden artifact path/,
  );

  await unlink(path.join(sourceDirectory, ".env"));
  await writeFile(path.join(sourceDirectory, ".cache"), "fixture\n", "utf8");
  await assert.rejects(
    prepareBuildArtifact(fixture),
    /forbidden artifact path/,
  );
  await unlink(path.join(sourceDirectory, ".cache"));
});

test("symlinks outside the allowlisted Next package mirror are rejected", async (context) => {
  const fixture = await createFixture();
  const sourceDirectory = path.join(fixture.repositoryRoot, "build", "api");
  const linkPath = path.join(sourceDirectory, "linked.js");
  try {
    await symlink(path.join(sourceDirectory, "server.js"), linkPath);
  } catch (error) {
    if (["EPERM", "EACCES"].includes(error.code)) {
      context.skip("symlink creation is not permitted on this Windows host");
      return;
    }
    throw error;
  }

  await assert.rejects(prepareBuildArtifact(fixture), /symlink is not allowed/);
});

test("source parent links are rejected before files are read", async (context) => {
  const fixture = await createFixture();
  const outsideRoot = await mkdtemp(
    path.join(os.tmpdir(), "dnd-ai-outside-source-"),
  );
  await mkdir(path.join(outsideRoot, "api"), { recursive: true });
  await writeFile(
    path.join(outsideRoot, "api", "server.js"),
    "export const outside = true;\n",
    "utf8",
  );
  await rm(path.join(fixture.repositoryRoot, "build"), {
    force: true,
    recursive: true,
  });

  if (
    !(await createDirectoryLinkOrSkip(
      context,
      outsideRoot,
      path.join(fixture.repositoryRoot, "build"),
    ))
  ) {
    return;
  }

  await assert.rejects(
    prepareBuildArtifact(fixture),
    /build source traverses a symlink or junction/,
  );
});

test("artifact parent links are rejected before cleanup", async (context) => {
  const fixture = await createFixture();
  const outsideRoot = await mkdtemp(
    path.join(os.tmpdir(), "dnd-ai-outside-artifact-"),
  );
  const outsideOutput = path.join(outsideRoot, "bl002");
  const sentinelPath = path.join(outsideOutput, "sentinel.txt");
  await mkdir(outsideOutput, { recursive: true });
  await writeFile(sentinelPath, "must survive\n", "utf8");

  if (
    !(await createDirectoryLinkOrSkip(
      context,
      outsideRoot,
      path.join(fixture.repositoryRoot, "artifacts"),
    ))
  ) {
    return;
  }

  await assert.rejects(
    prepareBuildArtifact(fixture),
    /artifact output traverses a symlink or junction/,
  );
  assert.equal(await readFile(sentinelPath, "utf8"), "must survive\n");
});

test("Next dependency links require their traced standalone mirror", async (context) => {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), "dnd-ai-next-artifact-"),
  );
  const standaloneRoot = path.join(
    repositoryRoot,
    "apps",
    "web",
    ".next",
    "standalone",
  );
  const externalPackage = path.join(
    repositoryRoot,
    "node_modules",
    ".pnpm",
    "example@1.0.0",
    "node_modules",
    "example",
  );
  const dependencyLink = path.join(standaloneRoot, "node_modules", "example");
  await mkdir(externalPackage, { recursive: true });
  await mkdir(path.dirname(dependencyLink), { recursive: true });
  const privateKeyExample = ["-----BEGIN ", "PRIVATE KEY-----"].join("");
  await writeFile(
    path.join(externalPackage, "index.js"),
    `${privateKeyExample}\n`,
    "utf8",
  );

  if (
    !(await createDirectoryLinkOrSkip(context, externalPackage, dependencyLink))
  ) {
    return;
  }

  const fixture = {
    repositoryRoot,
    outputDirectory: path.join(repositoryRoot, "artifacts", "bl002"),
    sourceRoots: [{ source: "apps/web/.next/standalone", target: "web" }],
  };
  await assert.rejects(
    prepareBuildArtifact(fixture),
    /traced symlink mirror is missing or unsafe/,
  );

  const mirroredPackage = path.join(
    standaloneRoot,
    "node_modules",
    ".pnpm",
    "example@1.0.0",
    "node_modules",
    "example",
  );
  await mkdir(mirroredPackage, { recursive: true });
  await writeFile(
    path.join(mirroredPackage, "index.js"),
    "export const traced = true;\n",
    "utf8",
  );
  await prepareBuildArtifact(fixture);

  assert.equal(
    await readFile(
      path.join(
        fixture.outputDirectory,
        "payload",
        "web",
        "node_modules",
        "example",
        "index.js",
      ),
      "utf8",
    ),
    "export const traced = true;\n",
  );
});
