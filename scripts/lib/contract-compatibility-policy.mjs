import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { normalizeContractArtifactPath } from "./contract-artifact-policy.mjs";

const execFileAsync = promisify(execFile);
const GENERATED_TREE_PREFIX = "packages/contracts/generated";
const EXPLICIT_BASE_REF_PATTERN = /^(?:[0-9a-f]{40}|HEAD\^1|origin\/main)$/u;
const GIT_TIMEOUT_MS = 10_000;
const GIT_MAX_BUFFER_BYTES = 50 * 1024 * 1024;

function normalizeFiles(files, label) {
  if (!(files instanceof Map)) {
    throw new TypeError(`${label} contract files must be a Map`);
  }

  const normalized = new Map();

  for (const [relativePath, content] of files) {
    const safePath = normalizeContractArtifactPath(relativePath);

    if (typeof content !== "string") {
      throw new TypeError(
        `${label} contract content must be text: ${safePath}`,
      );
    }

    normalized.set(safePath, content);
  }

  return normalized;
}

function majorOf(relativePath) {
  return Number(relativePath.slice(1, relativePath.indexOf("/")));
}

export function compareContractCompatibilityBaseline(
  baselineFiles,
  candidateFiles,
) {
  const baseline = normalizeFiles(baselineFiles, "baseline");
  const candidate = normalizeFiles(candidateFiles, "candidate");

  if (baseline.size === 0) {
    const candidateMajors = new Set(
      [...candidate.keys()].map((relativePath) => majorOf(relativePath)),
    );

    if (
      candidate.size === 0 ||
      candidateMajors.size !== 1 ||
      !candidateMajors.has(1)
    ) {
      return ["contract bootstrap must publish exactly major v1"];
    }

    return [];
  }

  const errors = [];
  const publishedMajors = new Set(
    [...baseline.keys()].map((relativePath) => majorOf(relativePath)),
  );
  const highestPublishedMajor = Math.max(...publishedMajors);

  for (const relativePath of [...baseline.keys()].sort()) {
    if (!candidate.has(relativePath)) {
      errors.push(`published artifact missing: ${relativePath}`);
    } else if (candidate.get(relativePath) !== baseline.get(relativePath)) {
      errors.push(`published artifact changed: ${relativePath}`);
    }
  }

  for (const relativePath of [...candidate.keys()].sort()) {
    const major = majorOf(relativePath);

    if (publishedMajors.has(major) && !baseline.has(relativePath)) {
      errors.push(`published artifact unexpected: ${relativePath}`);
    } else if (
      !publishedMajors.has(major) &&
      major !== highestPublishedMajor + 1
    ) {
      errors.push(`new contract major must be v${highestPublishedMajor + 1}`);
    }
  }

  return [...new Set(errors)];
}

async function runGit(repositoryRoot, arguments_) {
  return execFileAsync("git", arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: GIT_MAX_BUFFER_BYTES,
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
  });
}

async function resolveCommit(repositoryRoot, revision) {
  try {
    const { stdout } = await runGit(repositoryRoot, [
      "rev-parse",
      "--verify",
      `${revision}^{commit}`,
    ]);
    const commit = stdout.trim();

    if (!/^[0-9a-f]{40}$/u.test(commit)) {
      throw new Error("resolved commit is not a canonical SHA-1");
    }

    return commit;
  } catch {
    return null;
  }
}

export async function resolveContractCompatibilityBase(
  repositoryRoot,
  explicitBaseRef,
) {
  if (explicitBaseRef !== undefined && explicitBaseRef !== "") {
    if (!EXPLICIT_BASE_REF_PATTERN.test(explicitBaseRef)) {
      throw new Error("contract compatibility base ref is invalid");
    }

    const explicitCommit = await resolveCommit(repositoryRoot, explicitBaseRef);
    if (explicitCommit === null) {
      throw new Error(
        "contract compatibility baseline is unavailable; make the Git history available without fetching in the check",
      );
    }

    return explicitCommit;
  }

  for (const fallback of ["origin/main", "HEAD^1", "HEAD"]) {
    const commit = await resolveCommit(repositoryRoot, fallback);
    if (commit !== null) {
      return commit;
    }
  }

  throw new Error(
    "contract compatibility baseline is unavailable; make origin/main or a parent commit available",
  );
}

export async function readContractArtifactsAtCommit(repositoryRoot, commit) {
  if (!/^[0-9a-f]{40}$/u.test(commit)) {
    throw new Error("contract compatibility commit is invalid");
  }

  let stdout;
  try {
    ({ stdout } = await runGit(repositoryRoot, [
      "ls-tree",
      "-r",
      "-z",
      "--name-only",
      commit,
      "--",
      `${GENERATED_TREE_PREFIX}/`,
    ]));
  } catch {
    throw new Error(
      "contract compatibility baseline tree is unavailable; no network fetch was attempted",
    );
  }

  const files = new Map();
  const paths = stdout.split("\0").filter(Boolean).sort();

  for (const repositoryPath of paths) {
    if (!repositoryPath.startsWith(`${GENERATED_TREE_PREFIX}/`)) {
      throw new Error("contract compatibility tree escaped generated root");
    }

    const relativePath = normalizeContractArtifactPath(
      repositoryPath.slice(GENERATED_TREE_PREFIX.length + 1),
    );
    let content;
    try {
      ({ stdout: content } = await runGit(repositoryRoot, [
        "show",
        `${commit}:${repositoryPath}`,
      ]));
    } catch {
      throw new Error(
        `contract compatibility artifact is unavailable: ${relativePath}`,
      );
    }

    files.set(relativePath, content);
  }

  return files;
}
