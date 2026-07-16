import { glob, lstat, realpath } from "node:fs/promises";
import path from "node:path";

export const CHILD_ENV_ALLOWLIST = Object.freeze([
  "CI",
  "GITHUB_ACTIONS",
  "HOME",
  "LOCALAPPDATA",
  "PATH",
  "Path",
  "PATHEXT",
  "PNPM_HOME",
  "RUNNER_OS",
  "SYSTEMROOT",
  "TEMP",
  "TMP",
  "TURBO_FORCE",
  "USERPROFILE",
  "WINDIR",
]);

function freezeLane(configuration) {
  return Object.freeze({
    ...configuration,
    buildFilters: Object.freeze([...configuration.buildFilters]),
    ownerTaskIds: Object.freeze([...configuration.ownerTaskIds]),
    patterns: Object.freeze([...configuration.patterns]),
  });
}

export const TEST_LANES = Object.freeze({
  unit: freezeLane({
    buildFilters: [
      "@dnd-ai/api",
      "@dnd-ai/config",
      "@dnd-ai/domain",
      "@dnd-ai/observability",
      "@dnd-ai/persistence",
      "@dnd-ai/testing",
      "@dnd-ai/worker",
    ],
    concurrency: 4,
    name: "unit",
    ownerTaskIds: ["QA-001"],
    patterns: ["tests/unit/*.test.mjs"],
    timeoutMs: 300_000,
  }),
  integration: freezeLane({
    buildFilters: [
      "@dnd-ai/api",
      "@dnd-ai/worker",
      "@dnd-ai/web",
      "@dnd-ai/testing",
    ],
    concurrency: 2,
    name: "integration",
    ownerTaskIds: ["QA-001"],
    patterns: ["tests/integration/*.test.mjs"],
    timeoutMs: 600_000,
  }),
  database: freezeLane({
    buildFilters: ["@dnd-ai/config", "@dnd-ai/persistence", "@dnd-ai/testing"],
    concurrency: 1,
    name: "database",
    ownerTaskIds: ["QA-001"],
    patterns: ["tests/database/*.test.mjs"],
    timeoutMs: 600_000,
  }),
  contract: freezeLane({
    buildFilters: ["@dnd-ai/contracts", "@dnd-ai/testing"],
    concurrency: 4,
    name: "contract",
    ownerTaskIds: ["QA-001"],
    patterns: ["tests/contracts/*.test.mjs"],
    timeoutMs: 300_000,
  }),
  security: freezeLane({
    buildFilters: [
      "@dnd-ai/api",
      "@dnd-ai/config",
      "@dnd-ai/observability",
      "@dnd-ai/persistence",
      "@dnd-ai/testing",
      "@dnd-ai/worker",
    ],
    concurrency: 2,
    name: "security",
    ownerTaskIds: ["QA-001"],
    patterns: ["tests/security/*.test.mjs"],
    timeoutMs: 300_000,
  }),
});

export function resolveTestLane(name) {
  if (!Object.hasOwn(TEST_LANES, name)) {
    throw new Error("test-runner: unknown-lane");
  }

  return TEST_LANES[name];
}

export function createChildEnvironment(source) {
  return Object.freeze(
    Object.fromEntries(
      CHILD_ENV_ALLOWLIST.flatMap((key) =>
        typeof source[key] === "string" ? [[key, source[key]]] : [],
      ),
    ),
  );
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

export async function discoverLaneFiles(repositoryRoot, lane) {
  const resolvedRoot = await realpath(path.resolve(repositoryRoot));
  const testsRoot = await realpath(path.join(resolvedRoot, "tests"));
  const files = new Set();

  for (const pattern of lane.patterns) {
    for await (const relativePath of glob(pattern, { cwd: resolvedRoot })) {
      const absolutePath = path.resolve(resolvedRoot, relativePath);
      const [entry, actualPath] = await Promise.all([
        lstat(absolutePath),
        realpath(absolutePath),
      ]);

      if (
        !entry.isFile() ||
        entry.isSymbolicLink() ||
        !isInside(testsRoot, actualPath) ||
        actualPath !== absolutePath ||
        !absolutePath.endsWith(".test.mjs")
      ) {
        throw new Error("test-runner: invalid-test-path");
      }

      files.add(absolutePath);
    }
  }

  const sortedFiles = [...files].sort();
  if (sortedFiles.length === 0) {
    throw new Error("test-runner: empty-lane");
  }

  return Object.freeze(sortedFiles);
}
