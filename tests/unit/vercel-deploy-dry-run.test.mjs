import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import {
  VERCEL_DEPLOY_REQUIRED_FILES,
  validateVercelDeployDryRun,
} from "../../scripts/lib/vercel-deploy-dry-run.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

function createManifest({ files = VERCEL_DEPLOY_REQUIRED_FILES } = {}) {
  const entries = files.map((filePath, index) => ({
    path: filePath,
    size: index + 1,
    mode: 33_206,
    sha: "a".repeat(40),
  }));

  return {
    framework: { name: "Next.js", slug: "nextjs" },
    basePath: repositoryRoot,
    fileCount: entries.length,
    totalSize: entries.reduce((total, entry) => total + entry.size, 0),
    ignoredCount: 0,
    ignored: [],
    directories: [],
    largestFiles: entries.slice(0, 10),
    files: entries,
  };
}

test("a bounded Next.js dry-run rooted at the repository is accepted", () => {
  assert.deepEqual(
    validateVercelDeployDryRun(createManifest(), {
      expectedBasePath: repositoryRoot,
    }),
    [],
  );
});

test("framework, root and source budgets fail closed", () => {
  const wrongFramework = createManifest();
  wrongFramework.framework.slug = "static";
  assert.ok(
    validateVercelDeployDryRun(wrongFramework, {
      expectedBasePath: repositoryRoot,
    }).includes('framework.slug must be "nextjs"'),
  );

  const wrongRoot = createManifest();
  wrongRoot.basePath = path.join(repositoryRoot, "apps", "web");
  assert.ok(
    validateVercelDeployDryRun(wrongRoot, {
      expectedBasePath: repositoryRoot,
    }).includes("basePath must match the repository root"),
  );

  const oversized = createManifest();
  oversized.files[0].size = 11 * 1024 * 1024;
  oversized.totalSize = oversized.files.reduce(
    (total, entry) => total + entry.size,
    0,
  );
  const budgetErrors = validateVercelDeployDryRun(oversized, {
    expectedBasePath: repositoryRoot,
  });
  assert.ok(budgetErrors.includes("totalSize exceeds the source budget"));
  assert.ok(budgetErrors.includes("a source file exceeds the file budget"));
});

test("cache, generated, private and non-relative paths are rejected", () => {
  for (const unsafePath of [
    ".turbo/cache/build.tar.zst",
    ".TURBO/cache/build.tar.zst",
    ".git/config",
    "artifacts/bl002/manifest.json",
    "apps/web/.env",
    "apps/web/.ENV.PRODUCTION",
    "apps/web/.next/server/app.js",
    "apps/web/node_modules/react/index.js",
    "../outside.txt",
    "/absolute.txt",
    "C:\\absolute.txt",
    "C:drive-relative.txt",
    "line\nbreak.txt",
  ]) {
    const manifest = createManifest({
      files: [...VERCEL_DEPLOY_REQUIRED_FILES, unsafePath],
    });
    assert.ok(
      validateVercelDeployDryRun(manifest, {
        expectedBasePath: repositoryRoot,
      }).includes("files contain an unsafe deployment path"),
      unsafePath,
    );
  }
});

test("zero-byte directory placeholders may represent ignored paths", () => {
  const manifest = createManifest();
  manifest.files.push({ path: ".turbo", size: 0, mode: 0o040666 });
  manifest.fileCount += 1;

  assert.deepEqual(
    validateVercelDeployDryRun(manifest, {
      expectedBasePath: repositoryRoot,
    }),
    [],
  );
});

test("symlinks, malformed hashes and directory-only required inputs fail", () => {
  const symlink = createManifest();
  symlink.files[0].mode = 0o120777;
  assert.ok(
    validateVercelDeployDryRun(symlink, {
      expectedBasePath: repositoryRoot,
    }).includes("files contain an unsupported entry type"),
  );

  const malformedHash = createManifest();
  malformedHash.files[0].sha = "not-a-content-hash";
  assert.ok(
    validateVercelDeployDryRun(malformedHash, {
      expectedBasePath: repositoryRoot,
    }).includes("files contain an invalid content hash"),
  );

  const directoryInput = createManifest();
  directoryInput.files[0] = {
    path: VERCEL_DEPLOY_REQUIRED_FILES[0],
    size: 0,
    mode: 0o040666,
  };
  directoryInput.totalSize = directoryInput.files.reduce(
    (total, entry) => total + entry.size,
    0,
  );
  assert.ok(
    validateVercelDeployDryRun(directoryInput, {
      expectedBasePath: repositoryRoot,
    }).includes("required deployment inputs are missing"),
  );
});

test("missing inputs, duplicate paths and inconsistent manifest totals fail", () => {
  const missing = createManifest({
    files: VERCEL_DEPLOY_REQUIRED_FILES.filter(
      (filePath) => filePath !== "apps/web/vercel.json",
    ),
  });
  assert.ok(
    validateVercelDeployDryRun(missing, {
      expectedBasePath: repositoryRoot,
    }).includes("required deployment inputs are missing"),
  );

  const duplicate = createManifest({
    files: [...VERCEL_DEPLOY_REQUIRED_FILES, VERCEL_DEPLOY_REQUIRED_FILES[0]],
  });
  duplicate.totalSize += 1;
  const duplicateErrors = validateVercelDeployDryRun(duplicate, {
    expectedBasePath: repositoryRoot,
  });
  assert.ok(duplicateErrors.includes("deployment paths must be unique"));

  const inconsistent = createManifest();
  inconsistent.fileCount += 1;
  inconsistent.totalSize += 1;
  const inconsistentErrors = validateVercelDeployDryRun(inconsistent, {
    expectedBasePath: repositoryRoot,
  });
  assert.ok(inconsistentErrors.includes("fileCount must equal files length"));
  assert.ok(
    inconsistentErrors.includes("totalSize must equal source file sizes"),
  );
});
