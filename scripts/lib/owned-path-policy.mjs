import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

function isInsideOrSame(root, candidate) {
  const relative = path.relative(root, candidate);

  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

async function lstatIfPresent(targetPath) {
  try {
    return await lstat(targetPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function assertOwnedPathChain(
  repositoryRoot,
  ownedPath,
  { allowMissing = true, finalType = "directory" } = {},
) {
  const absoluteRoot = path.resolve(repositoryRoot);
  const absoluteOwnedPath = path.resolve(ownedPath);

  if (
    absoluteOwnedPath === absoluteRoot ||
    !isInsideOrSame(absoluteRoot, absoluteOwnedPath)
  ) {
    throw new Error("owned path escapes repository root");
  }

  const rootStat = await lstatIfPresent(absoluteRoot);
  if (rootStat?.isSymbolicLink()) {
    throw new Error("owned path contains a symbolic link or junction");
  }
  if (rootStat === null || !rootStat.isDirectory()) {
    throw new Error("repository root is not a directory");
  }

  const rootRealPath = await realpath(absoluteRoot);
  const segments = path
    .relative(absoluteRoot, absoluteOwnedPath)
    .split(path.sep);
  let currentPath = absoluteRoot;
  let lastExistingPath = absoluteRoot;
  let missing = false;

  for (const [index, segment] of segments.entries()) {
    currentPath = path.join(currentPath, segment);

    if (missing) {
      continue;
    }

    const stat = await lstatIfPresent(currentPath);
    if (stat === null) {
      if (!allowMissing) {
        throw new Error("required owned path is missing");
      }

      missing = true;
      continue;
    }

    if (stat.isSymbolicLink()) {
      throw new Error("owned path contains a symbolic link or junction");
    }

    const isFinal = index === segments.length - 1;
    if (!isFinal && !stat.isDirectory()) {
      throw new Error("owned path ancestor is not a directory");
    }
    if (isFinal && finalType === "directory" && !stat.isDirectory()) {
      throw new Error("owned path is not a directory");
    }
    if (isFinal && finalType === "file" && !stat.isFile()) {
      throw new Error("owned path is not a regular file");
    }

    lastExistingPath = currentPath;
  }

  const lastExistingRealPath = await realpath(lastExistingPath);
  if (!isInsideOrSame(rootRealPath, lastExistingRealPath)) {
    throw new Error("owned path real location escapes repository root");
  }
}
