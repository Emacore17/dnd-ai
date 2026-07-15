import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { validateDocumentIntegrity } from "./document-integrity-policy.mjs";
import {
  markdownLinkTargets,
  parseFrontMatter,
  referenceTarget,
} from "./markdown-document.mjs";

const execFileAsync = promisify(execFile);
const REQUIRED_FIELDS = [
  "status",
  "owner",
  "last_reviewed",
  "last_verified_commit",
  "source_refs",
  "related_tasks",
  "code_refs",
  "test_refs",
  "supersedes",
];
const LIVING_STATUSES = new Set(["active", "draft", "superseded"]);
const ADR_STATUSES = new Set(["accepted", "draft", "proposed", "superseded"]);

function normalizeRepositoryPath(filePath) {
  return filePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function splitNullOutput(output) {
  return output.split("\0").filter(Boolean).map(normalizeRepositoryPath);
}

function repositoryPath(repositoryRoot, relativePath) {
  const normalizedPath = normalizeRepositoryPath(relativePath);
  const absolutePath = path.resolve(
    repositoryRoot,
    ...normalizedPath.split("/"),
  );
  const relativeToRoot = path.relative(repositoryRoot, absolutePath);

  if (
    relativeToRoot === ".." ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRoot)
  ) {
    return null;
  }

  return absolutePath;
}

async function pathExists(repositoryRoot, relativePath) {
  const absolutePath = repositoryPath(repositoryRoot, relativePath);
  if (!absolutePath) {
    return false;
  }

  try {
    await stat(absolutePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      return false;
    }
    throw error;
  }
}

async function runGit(repositoryRoot, args, { allowFailure = false } = {}) {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });
    return { code: 0, stdout };
  } catch (error) {
    if (allowFailure && typeof error?.code === "number") {
      return { code: error.code, stdout: error.stdout ?? "" };
    }
    throw error;
  }
}

function taskIdsFromSource(source) {
  const taskIds = new Set();

  for (const line of source.split(/\r?\n/u)) {
    if (!line.startsWith("### ")) {
      continue;
    }

    const candidate = line.slice(4).trimStart().split(/\s/u, 1)[0];
    const fragments = candidate.split("-");
    const valid =
      fragments.length > 1 &&
      fragments.every(
        (fragment) =>
          fragment.length > 0 &&
          [...fragment].every(
            (character) =>
              (character >= "A" && character <= "Z") ||
              (character >= "0" && character <= "9"),
          ),
      );

    if (valid) {
      taskIds.add(candidate);
    }
  }

  return taskIds;
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}

function isExternalLink(target) {
  return (
    target.startsWith("#") ||
    /^[a-z][a-z0-9+.-]*:/iu.test(target) ||
    target.startsWith("//")
  );
}

async function defaultCommitExists(repositoryRoot, commit) {
  if (!/^[0-9a-f]{7,40}$/iu.test(commit)) {
    return false;
  }

  const result = await runGit(
    repositoryRoot,
    ["cat-file", "-e", `${commit}^{commit}`],
    { allowFailure: true },
  );
  return result.code === 0;
}

export async function discoverMarkdownDocuments(repositoryRoot) {
  const root = path.resolve(repositoryRoot);
  const [allResult, untrackedResult, headResult, mergeBaseResult] =
    await Promise.all([
      runGit(root, [
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
        "--",
        "*.md",
      ]),
      runGit(root, [
        "ls-files",
        "--others",
        "--exclude-standard",
        "-z",
        "--",
        "*.md",
      ]),
      runGit(root, ["rev-parse", "--verify", "HEAD"], { allowFailure: true }),
      runGit(root, ["merge-base", "HEAD", "origin/main"], {
        allowFailure: true,
      }),
    ]);
  const candidates = [...new Set(splitNullOutput(allResult.stdout))].sort();
  const existence = await Promise.all(
    candidates.map(async (documentPath) => ({
      documentPath,
      exists: await pathExists(root, documentPath),
    })),
  );
  const documentPaths = existence
    .filter(({ exists }) => exists)
    .map(({ documentPath }) => documentPath);
  let changedDocumentPaths;

  if (headResult.code === 0) {
    const changedResult = await runGit(root, [
      "diff",
      "--name-only",
      "-z",
      "HEAD",
      "--",
      "*.md",
    ]);
    const changedOutputs = [changedResult.stdout, untrackedResult.stdout];
    const mergeBase =
      mergeBaseResult.code === 0 ? mergeBaseResult.stdout.trim() : null;

    if (mergeBase) {
      const branchDifference = await runGit(root, [
        "diff",
        "--name-only",
        "-z",
        mergeBase,
        "--",
        "*.md",
      ]);
      changedOutputs.push(branchDifference.stdout);
    }

    changedDocumentPaths = [...new Set(changedOutputs.flatMap(splitNullOutput))]
      .filter((documentPath) => documentPaths.includes(documentPath))
      .sort();
  } else {
    changedDocumentPaths = [...documentPaths];
  }

  return { changedDocumentPaths, documentPaths };
}

export async function validateDocumentPolicy({
  repositoryRoot,
  documentPaths,
  changedDocumentPaths,
  today,
  commitExists = (commit) => defaultCommitExists(repositoryRoot, commit),
}) {
  const root = path.resolve(repositoryRoot);
  const changed = new Set(changedDocumentPaths.map(normalizeRepositoryPath));
  const normalizedDocuments = [
    ...new Set(documentPaths.map(normalizeRepositoryPath)),
  ].sort();
  const sources = new Map();
  const metadataByPath = new Map();
  const errors = [];
  const warnings = [];

  for (const documentPath of normalizedDocuments) {
    const absolutePath = repositoryPath(root, documentPath);
    if (!absolutePath) {
      errors.push(`${documentPath}: path-outside-repository`);
      continue;
    }
    sources.set(documentPath, await readFile(absolutePath, "utf8"));
  }

  const tasksSource = sources.get("docs/TASKS.md") ?? "";
  const knownTaskIds = taskIdsFromSource(tasksSource);

  for (const [documentPath, source] of sources) {
    const metadata = parseFrontMatter(source);
    metadataByPath.set(documentPath, metadata);
    const isChanged = changed.has(documentPath);

    if (isChanged) {
      source.split(/\r?\n/u).forEach((line, index) => {
        if (line.trimEnd().length !== line.length) {
          errors.push(`${documentPath}: trailing-whitespace line ${index + 1}`);
        }
      });
    }

    if (!metadata) {
      (isChanged ? errors : warnings).push(
        `${documentPath}: missing-front-matter`,
      );
      continue;
    }

    for (const field of REQUIRED_FIELDS) {
      if (!Object.hasOwn(metadata, field)) {
        errors.push(`${documentPath}: missing-front-matter-field ${field}`);
      }
    }

    const allowedStatuses =
      documentPath.startsWith("docs/adr/") &&
      documentPath !== "docs/adr/README.md"
        ? ADR_STATUSES
        : LIVING_STATUSES;
    if (!allowedStatuses.has(metadata.status)) {
      errors.push(`${documentPath}: invalid-status ${String(metadata.status)}`);
    }
    if (typeof metadata.owner !== "string" || !metadata.owner.trim()) {
      errors.push(`${documentPath}: invalid-owner`);
    }

    if (!isIsoDate(metadata.last_reviewed)) {
      errors.push(`${documentPath}: invalid-last-reviewed`);
    } else {
      if (metadata.last_reviewed > today) {
        errors.push(`${documentPath}: future-last-reviewed`);
      }
      if (isChanged && metadata.last_reviewed !== today) {
        errors.push(`${documentPath}: changed-last-reviewed-not-today`);
      }
    }

    if (isChanged) {
      const verifiedCommit = metadata.last_verified_commit;
      if (
        verifiedCommit !== "unversioned" &&
        (typeof verifiedCommit !== "string" ||
          !(await commitExists(verifiedCommit)))
      ) {
        errors.push(
          `${documentPath}: changed-last-verified-commit-missing ${String(verifiedCommit)}`,
        );
      }
    }

    for (const [field, label] of [
      ["source_refs", "source-ref"],
      ["code_refs", "code-ref"],
      ["test_refs", "test-ref"],
    ]) {
      const references = metadata[field];
      if (!Array.isArray(references)) {
        errors.push(`${documentPath}: invalid-${field}`);
        continue;
      }

      for (const reference of references) {
        const parsedReference = referenceTarget(reference);
        if (!parsedReference) {
          errors.push(`${documentPath}: invalid-${label} ${String(reference)}`);
          continue;
        }
        if (
          !parsedReference.planned &&
          !(await pathExists(root, parsedReference.target))
        ) {
          errors.push(
            `${documentPath}: missing-${label} ${parsedReference.target}`,
          );
        }
      }
    }

    if (!Array.isArray(metadata.related_tasks)) {
      errors.push(`${documentPath}: invalid-related_tasks`);
    } else {
      for (const taskId of metadata.related_tasks) {
        if (typeof taskId !== "string" || !knownTaskIds.has(taskId)) {
          errors.push(
            `${documentPath}: unknown-related-task ${String(taskId)}`,
          );
        }
      }
    }

    for (const target of markdownLinkTargets(source)) {
      if (isExternalLink(target)) {
        continue;
      }
      let decodedTarget;
      try {
        decodedTarget = decodeURIComponent(target.split("#", 1)[0]);
      } catch {
        errors.push(`${documentPath}: invalid-relative-link ${target}`);
        continue;
      }
      const relativeTarget = normalizeRepositoryPath(
        path.posix.join(path.posix.dirname(documentPath), decodedTarget),
      );
      if (!(await pathExists(root, relativeTarget))) {
        errors.push(`${documentPath}: broken-relative-link ${target}`);
      }
    }
  }

  const integrity = await validateDocumentIntegrity({
    metadataByPath,
    sources,
  });
  errors.push(...integrity.errors);

  return { errors: errors.sort(), warnings: warnings.sort() };
}

export async function checkDocumentationRepository(
  repositoryRoot,
  { today = new Date().toLocaleDateString("en-CA") } = {},
) {
  const discovery = await discoverMarkdownDocuments(repositoryRoot);
  const result = await validateDocumentPolicy({
    repositoryRoot,
    ...discovery,
    today,
  });
  return { ...discovery, ...result };
}
