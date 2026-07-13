import { createHash } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { formatSecretFinding, scanSecretBuffer } from "./secret-scanner.mjs";

export const DEFAULT_BUILD_ROOTS = Object.freeze([
  { source: "apps/web/.next/standalone", target: "web" },
  {
    source: "apps/web/.next/static",
    target: "web/apps/web/.next/static",
  },
  { source: "apps/api/dist", target: "api/dist" },
  { source: "apps/worker/dist", target: "worker/dist" },
  { source: "packages/contracts/dist", target: "packages/contracts/dist" },
  { source: "packages/domain/dist", target: "packages/domain/dist" },
  { source: "packages/rules/dist", target: "packages/rules/dist" },
  { source: "packages/ai/dist", target: "packages/ai/dist" },
  {
    source: "packages/persistence/dist",
    target: "packages/persistence/dist",
  },
  {
    source: "packages/observability/dist",
    target: "packages/observability/dist",
  },
  { source: "packages/testing/dist", target: "packages/testing/dist" },
]);

const FORBIDDEN_FILE_NAMES = new Set([
  ".npmrc",
  ".netrc",
  "credentials",
  "credentials.json",
  "id_ed25519",
  "id_rsa",
  "secrets.json",
]);

function toPosixPath(filePath) {
  return filePath.replaceAll(path.sep, "/");
}

function isInside(parentDirectory, candidatePath) {
  const relativePath = path.relative(parentDirectory, candidatePath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${path.sep}`) && relativePath !== "..")
  );
}

async function lstatOrNull(candidatePath) {
  return lstat(candidatePath).catch((error) => {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  });
}

async function assertPathAncestorsStayInside(
  baseDirectory,
  candidatePath,
  label,
) {
  const resolvedBase = path.resolve(baseDirectory);
  const resolvedCandidate = path.resolve(candidatePath);

  if (!isInside(resolvedBase, resolvedCandidate)) {
    throw new Error(`${label} escapes its trusted root`);
  }

  const realBase = await realpath(resolvedBase);
  const relativePath = path.relative(resolvedBase, resolvedCandidate);
  let currentPath = resolvedBase;

  for (const segment of relativePath.split(path.sep).filter(Boolean)) {
    currentPath = path.join(currentPath, segment);
    const currentStat = await lstatOrNull(currentPath);

    if (!currentStat) {
      break;
    }

    if (currentStat.isSymbolicLink()) {
      throw new Error(
        `${label} traverses a symlink or junction: ${currentPath}`,
      );
    }

    const currentRealPath = await realpath(currentPath);

    if (!isInside(realBase, currentRealPath)) {
      throw new Error(
        `${label} resolves outside its trusted root: ${currentPath}`,
      );
    }
  }
}

function assertSafeRelativePath(relativePath, label) {
  const normalizedPath = path.normalize(relativePath);

  if (
    !relativePath ||
    path.isAbsolute(relativePath) ||
    normalizedPath === ".." ||
    normalizedPath.startsWith(`..${path.sep}`)
  ) {
    throw new Error(
      `${label} must be a repository-relative path: ${relativePath}`,
    );
  }

  return normalizedPath;
}

function assertArtifactOutput(repositoryRoot, outputDirectory) {
  const artifactsRoot = path.join(repositoryRoot, "artifacts");

  if (
    outputDirectory === artifactsRoot ||
    !isInside(artifactsRoot, outputDirectory)
  ) {
    throw new Error("artifact output must stay inside artifacts/<task>");
  }
}

function assertAllowedArtifactPath(relativePath) {
  const lowerPath = toPosixPath(relativePath).toLowerCase();
  const fileName = path.basename(lowerPath);
  const unexpectedHiddenSegment = lowerPath
    .split("/")
    .find(
      (segment) =>
        segment.startsWith(".") && ![".next", ".pnpm"].includes(segment),
    );

  if (
    unexpectedHiddenSegment ||
    /(^|\/)\.env(?:\.|$)/.test(lowerPath) ||
    fileName.endsWith(".log") ||
    FORBIDDEN_FILE_NAMES.has(fileName)
  ) {
    throw new Error(`forbidden artifact path: ${toPosixPath(relativePath)}`);
  }
}

async function collectFiles(
  directory,
  relativeDirectory = "",
  {
    allowedSymlinkTargetRoot = null,
    symlinkMirrorRoot = null,
    activeDirectories = new Set(),
    collectionRoot = null,
  } = {},
) {
  const directoryStat = await lstatOrNull(directory);

  if (!directoryStat) {
    return null;
  }

  if (directoryStat.isSymbolicLink()) {
    throw new Error(`symlink is not allowed: ${directory}`);
  }

  if (!directoryStat.isDirectory()) {
    throw new Error(`required build output is not a directory: ${directory}`);
  }

  const realDirectory = await realpath(directory);
  const resolvedCollectionRoot = collectionRoot ?? realDirectory;

  if (!isInside(resolvedCollectionRoot, realDirectory)) {
    throw new Error(`artifact source resolves outside its root: ${directory}`);
  }

  if (activeDirectories.has(realDirectory)) {
    throw new Error(`symlink cycle is not allowed: ${directory}`);
  }

  activeDirectories.add(realDirectory);
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const entryPath = path.join(directory, entry.name);
    const relativePath = path.join(relativeDirectory, entry.name);

    if (entry.isSymbolicLink()) {
      const targetPath = await realpath(entryPath);

      if (
        !allowedSymlinkTargetRoot ||
        !isInside(allowedSymlinkTargetRoot, targetPath)
      ) {
        throw new Error(`symlink is not allowed: ${entryPath}`);
      }

      if (!symlinkMirrorRoot) {
        throw new Error(`traced symlink mirror is required: ${entryPath}`);
      }

      const mirroredTarget = path.join(
        symlinkMirrorRoot,
        path.relative(allowedSymlinkTargetRoot, targetPath),
      );
      const mirroredStat = await lstatOrNull(mirroredTarget);

      if (
        !mirroredStat ||
        mirroredStat.isSymbolicLink() ||
        (!mirroredStat.isDirectory() && !mirroredStat.isFile())
      ) {
        throw new Error(
          `traced symlink mirror is missing or unsafe: ${entryPath}`,
        );
      }

      const mirroredRealPath = await realpath(mirroredTarget);

      if (!isInside(resolvedCollectionRoot, mirroredRealPath)) {
        throw new Error(
          `traced symlink mirror escapes build output: ${entryPath}`,
        );
      }

      if (mirroredStat.isDirectory()) {
        const nestedFiles = await collectFiles(mirroredRealPath, relativePath, {
          allowedSymlinkTargetRoot,
          symlinkMirrorRoot,
          activeDirectories,
          collectionRoot: resolvedCollectionRoot,
        });
        files.push(...(nestedFiles ?? []));
      } else if (mirroredStat.isFile()) {
        files.push({
          absolutePath: mirroredRealPath,
          relativePath,
          collectionRoot: resolvedCollectionRoot,
        });
      } else {
        throw new Error(`unsupported symlink target: ${entryPath}`);
      }

      continue;
    }

    if (entry.isDirectory()) {
      const nestedFiles = await collectFiles(entryPath, relativePath, {
        allowedSymlinkTargetRoot,
        symlinkMirrorRoot,
        activeDirectories,
        collectionRoot: resolvedCollectionRoot,
      });
      files.push(...(nestedFiles ?? []));
      continue;
    }

    if (!entry.isFile()) {
      throw new Error(`unsupported artifact entry: ${entryPath}`);
    }

    files.push({
      absolutePath: entryPath,
      relativePath,
      collectionRoot: resolvedCollectionRoot,
    });
  }

  activeDirectories.delete(realDirectory);
  return files;
}

function hashBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function prepareBuildArtifact({
  repositoryRoot,
  outputDirectory = path.join(repositoryRoot, "artifacts", "bl002"),
  sourceRoots = DEFAULT_BUILD_ROOTS,
}) {
  const resolvedRoot = path.resolve(repositoryRoot);
  const resolvedOutput = path.resolve(outputDirectory);
  assertArtifactOutput(resolvedRoot, resolvedOutput);
  await assertPathAncestorsStayInside(
    resolvedRoot,
    resolvedOutput,
    "artifact output",
  );

  const plannedFiles = [];
  const targetPaths = new Set();

  for (const root of sourceRoots) {
    const source = assertSafeRelativePath(root.source, "build source");
    const target = assertSafeRelativePath(root.target, "artifact target");
    const sourceDirectory = path.resolve(resolvedRoot, source);

    if (!isInside(resolvedRoot, sourceDirectory)) {
      throw new Error(`build source escapes repository: ${root.source}`);
    }

    await assertPathAncestorsStayInside(
      resolvedRoot,
      sourceDirectory,
      "build source",
    );

    const isNextStandalone = root.source === "apps/web/.next/standalone";
    const pnpmStoreRoot = isNextStandalone
      ? path.join(resolvedRoot, "node_modules", ".pnpm")
      : null;

    if (pnpmStoreRoot) {
      await assertPathAncestorsStayInside(
        resolvedRoot,
        pnpmStoreRoot,
        "pnpm store",
      );
    }

    const sourceFiles = await collectFiles(sourceDirectory, "", {
      allowedSymlinkTargetRoot:
        pnpmStoreRoot && (await realpath(pnpmStoreRoot)),
      symlinkMirrorRoot: isNextStandalone
        ? path.join(sourceDirectory, "node_modules", ".pnpm")
        : null,
    });

    if (!sourceFiles || sourceFiles.length === 0) {
      throw new Error(
        `required build output is missing or empty: ${root.source}`,
      );
    }

    for (const sourceFile of sourceFiles) {
      const targetPath = path.join(target, sourceFile.relativePath);
      const normalizedTarget = toPosixPath(targetPath);
      assertAllowedArtifactPath(normalizedTarget);

      if (targetPaths.has(normalizedTarget)) {
        throw new Error(`artifact target collision: ${normalizedTarget}`);
      }

      targetPaths.add(normalizedTarget);
      plannedFiles.push({ ...sourceFile, targetPath: normalizedTarget });
    }
  }

  await rm(resolvedOutput, { force: true, recursive: true });
  await assertPathAncestorsStayInside(
    resolvedRoot,
    resolvedOutput,
    "artifact output",
  );
  const payloadDirectory = path.join(resolvedOutput, "payload");
  await mkdir(payloadDirectory, { recursive: true });
  await assertPathAncestorsStayInside(
    resolvedRoot,
    payloadDirectory,
    "artifact output",
  );
  const manifestFiles = [];

  for (const plannedFile of plannedFiles.sort((left, right) =>
    left.targetPath.localeCompare(right.targetPath),
  )) {
    const currentStat = await lstat(plannedFile.absolutePath);
    const currentRealPath = await realpath(plannedFile.absolutePath);

    if (
      currentStat.isSymbolicLink() ||
      !currentStat.isFile() ||
      !isInside(plannedFile.collectionRoot, currentRealPath)
    ) {
      throw new Error(
        `artifact source changed or escaped: ${plannedFile.targetPath}`,
      );
    }

    const buffer = await readFile(currentRealPath);
    const findings = scanSecretBuffer(buffer, plannedFile.targetPath);

    if (findings.length > 0) {
      throw new Error(
        `secret detected in artifact: ${formatSecretFinding(findings[0])}`,
      );
    }

    const destinationPath = path.join(payloadDirectory, plannedFile.targetPath);
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await copyFile(currentRealPath, destinationPath);
    manifestFiles.push({
      path: plannedFile.targetPath,
      bytes: buffer.byteLength,
      sha256: hashBuffer(buffer),
    });
  }

  const manifest = {
    schemaVersion: "build-artifact-v1",
    files: manifestFiles,
  };
  await writeFile(
    path.join(resolvedOutput, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return manifest;
}

export async function verifyBuildArtifact({
  repositoryRoot,
  outputDirectory = path.join(repositoryRoot, "artifacts", "bl002"),
}) {
  const resolvedRoot = path.resolve(repositoryRoot);
  const resolvedOutput = path.resolve(outputDirectory);
  assertArtifactOutput(resolvedRoot, resolvedOutput);
  const manifest = JSON.parse(
    await readFile(path.join(resolvedOutput, "manifest.json"), "utf8"),
  );
  const payloadDirectory = path.join(resolvedOutput, "payload");
  const payloadFiles = await collectFiles(payloadDirectory);
  const errors = [];
  const actualPaths = (payloadFiles ?? [])
    .map(({ relativePath }) => toPosixPath(relativePath))
    .sort();
  const expectedPaths = manifest.files
    .map(({ path: filePath }) => filePath)
    .sort();

  if (actualPaths.join("\0") !== expectedPaths.join("\0")) {
    errors.push("artifact payload does not match manifest paths");
  }

  const filesByPath = new Map(
    (payloadFiles ?? []).map((file) => [toPosixPath(file.relativePath), file]),
  );

  for (const manifestFile of manifest.files) {
    try {
      assertSafeRelativePath(manifestFile.path, "manifest path");
      assertAllowedArtifactPath(manifestFile.path);
    } catch (error) {
      errors.push(error.message);
      continue;
    }

    const actualFile = filesByPath.get(manifestFile.path);

    if (!actualFile) {
      continue;
    }

    const buffer = await readFile(actualFile.absolutePath);
    const actualHash = hashBuffer(buffer);

    if (
      actualHash !== manifestFile.sha256 ||
      buffer.byteLength !== manifestFile.bytes
    ) {
      errors.push(`artifact checksum mismatch: ${manifestFile.path}`);
    }

    for (const finding of scanSecretBuffer(buffer, manifestFile.path)) {
      errors.push(
        `secret detected in artifact: ${formatSecretFinding(finding)}`,
      );
    }
  }

  return [...new Set(errors)].sort();
}
