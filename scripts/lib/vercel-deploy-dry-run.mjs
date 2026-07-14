import path from "node:path";
import process from "node:process";

export const VERCEL_DEPLOY_MAX_FILES = 15_000;
export const VERCEL_DEPLOY_MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const VERCEL_DEPLOY_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const VERCEL_DEPLOY_REQUIRED_FILES = Object.freeze([
  ".vercelignore",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  "turbo.json",
  "apps/web/package.json",
  "apps/web/vercel.json",
  "apps/web/next.config.ts",
  "apps/web/app/layout.tsx",
  "apps/web/app/page.tsx",
  "apps/web/app/health/route.ts",
  "apps/web/scripts/assert-vercel-preview-build.mjs",
  "apps/web/scripts/vercel-preview-build-policy.mjs",
]);

const FORBIDDEN_PATH_SEGMENTS = new Set([
  ".agents",
  ".codex",
  ".git",
  ".next",
  ".pnpm-store",
  ".turbo",
  ".vercel",
  ".vscode",
  "artifacts",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeBasePath(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function normalizeDeploymentPath(value) {
  return value.replaceAll("\\", "/");
}

function isSupportedMode(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0o177777;
}

function isRegularFileEntry(entry) {
  return isSupportedMode(entry.mode) && (entry.mode & 0o170000) === 0o100000;
}

function isDirectoryEntry(entry) {
  return (
    isSupportedMode(entry.mode) &&
    (entry.mode & 0o170000) === 0o040000 &&
    entry.size === 0
  );
}

function hasControlCharacter(value) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}

function isUnsafeDeploymentPath(entry) {
  const value = entry.path;
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    hasControlCharacter(value)
  ) {
    return true;
  }

  const normalized = normalizeDeploymentPath(value);
  if (
    path.posix.isAbsolute(normalized) ||
    path.win32.isAbsolute(value) ||
    path.win32.parse(value).root.length > 0
  ) {
    return true;
  }

  const segments = normalized.split("/");
  const comparisonSegments = segments.map((segment) => segment.toLowerCase());
  const forbiddenSegmentIndex = comparisonSegments.findIndex((segment) =>
    FORBIDDEN_PATH_SEGMENTS.has(segment),
  );
  const ignoredDirectoryPlaceholder =
    forbiddenSegmentIndex === segments.length - 1 && isDirectoryEntry(entry);
  if (
    segments.some(
      (segment) => segment.length === 0 || segment === "." || segment === "..",
    )
  ) {
    return true;
  }
  if (forbiddenSegmentIndex >= 0 && !ignoredDirectoryPlaceholder) {
    return true;
  }

  const basename = (segments.at(-1) ?? "").toLowerCase();
  return (
    basename === ".env" ||
    basename.startsWith(".env.") ||
    basename.endsWith(".log") ||
    basename.endsWith(".tar.zst") ||
    basename.endsWith(".tsbuildinfo")
  );
}

export function validateVercelDeployDryRun(
  manifest,
  { expectedBasePath } = {},
) {
  const errors = [];
  if (!isRecord(manifest)) {
    return ["manifest must be an object"];
  }

  if (!isRecord(manifest.framework) || manifest.framework.slug !== "nextjs") {
    errors.push('framework.slug must be "nextjs"');
  }

  if (
    typeof manifest.basePath !== "string" ||
    typeof expectedBasePath !== "string" ||
    normalizeBasePath(manifest.basePath) !== normalizeBasePath(expectedBasePath)
  ) {
    errors.push("basePath must match the repository root");
  }

  if (!Array.isArray(manifest.files)) {
    errors.push("files must be an array");
    return [...new Set(errors)].sort();
  }

  const normalizedPaths = [];
  const regularFilePaths = [];
  let calculatedSize = 0;
  let invalidFileEntry = false;
  let unsupportedEntryType = false;
  let invalidContentHash = false;
  let unsafePath = false;
  let oversizedFile = false;

  for (const entry of manifest.files) {
    if (
      !isRecord(entry) ||
      typeof entry.path !== "string" ||
      !Number.isSafeInteger(entry.size) ||
      entry.size < 0 ||
      !isSupportedMode(entry.mode)
    ) {
      invalidFileEntry = true;
      continue;
    }

    const normalizedPath = normalizeDeploymentPath(entry.path);
    normalizedPaths.push(normalizedPath);
    calculatedSize += entry.size;
    unsafePath ||= isUnsafeDeploymentPath(entry);
    oversizedFile ||= entry.size > VERCEL_DEPLOY_MAX_FILE_BYTES;
    const regularFile = isRegularFileEntry(entry);
    unsupportedEntryType ||= !regularFile && !isDirectoryEntry(entry);
    if (regularFile) {
      regularFilePaths.push(normalizedPath);
      invalidContentHash ||=
        typeof entry.sha !== "string" || !/^[a-f0-9]{40}$/u.test(entry.sha);
    }
  }

  if (invalidFileEntry) {
    errors.push("files contain an invalid entry");
  }
  if (unsupportedEntryType) {
    errors.push("files contain an unsupported entry type");
  }
  if (invalidContentHash) {
    errors.push("files contain an invalid content hash");
  }
  if (unsafePath) {
    errors.push("files contain an unsafe deployment path");
  }
  if (oversizedFile) {
    errors.push("a source file exceeds the file budget");
  }

  if (
    !Number.isSafeInteger(manifest.fileCount) ||
    manifest.fileCount < 0 ||
    manifest.fileCount !== manifest.files.length
  ) {
    errors.push("fileCount must equal files length");
  }
  if (manifest.fileCount > VERCEL_DEPLOY_MAX_FILES) {
    errors.push("fileCount exceeds the Vercel source limit");
  }

  if (
    !Number.isSafeInteger(manifest.totalSize) ||
    manifest.totalSize < 0 ||
    manifest.totalSize !== calculatedSize
  ) {
    errors.push("totalSize must equal source file sizes");
  }
  if (manifest.totalSize > VERCEL_DEPLOY_MAX_SOURCE_BYTES) {
    errors.push("totalSize exceeds the source budget");
  }

  if (new Set(normalizedPaths).size !== normalizedPaths.length) {
    errors.push("deployment paths must be unique");
  }
  const pathSet = new Set(regularFilePaths);
  if (
    VERCEL_DEPLOY_REQUIRED_FILES.some(
      (requiredPath) => !pathSet.has(requiredPath),
    )
  ) {
    errors.push("required deployment inputs are missing");
  }

  return [...new Set(errors)].sort();
}
