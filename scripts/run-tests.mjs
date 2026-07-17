import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

import { assertOwnedPathChain } from "./lib/owned-path-policy.mjs";
import {
  TEST_LANES,
  createChildEnvironment,
  discoverLaneFiles,
  resolveTestLane,
} from "./lib/test-lane-policy.mjs";
import {
  reserveLoopbackPort,
  runCommandProcess,
  runPlaywrightProcess,
  runTestProcess,
} from "./lib/test-process.mjs";
import {
  normalizeJUnitReport,
  normalizeLcovReport,
} from "./lib/test-report-policy.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const turboEntry = path.join(
  repositoryRoot,
  "node_modules",
  "turbo",
  "bin",
  "turbo",
);
const corepackEntry = path.join(
  path.dirname(process.execPath),
  "node_modules",
  "corepack",
  "dist",
  "corepack.js",
);
const packageManagerCommand =
  process.platform === "win32" ? process.execPath : "pnpm";
const packageManagerArguments =
  process.platform === "win32" ? [corepackEntry, "pnpm@11.13.0"] : [];

function forward(result) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

async function createReportWorkspace(lane) {
  const laneDirectory = path.join(
    repositoryRoot,
    "test-results",
    "testing-foundation-v1",
    lane.name,
  );
  await assertOwnedPathChain(repositoryRoot, laneDirectory);
  await rm(laneDirectory, { force: true, recursive: true });
  const rawDirectory = path.join(laneDirectory, "raw");
  await mkdir(rawDirectory, { recursive: true });
  await assertOwnedPathChain(repositoryRoot, rawDirectory, {
    allowMissing: false,
  });

  return Object.freeze({
    coverage: path.join(rawDirectory, "coverage.lcov"),
    junit: path.join(rawDirectory, "junit.xml"),
    laneDirectory,
    rawDirectory,
  });
}

async function finalizeReports(lane, workspace) {
  try {
    const junit = normalizeJUnitReport(
      await readFile(workspace.junit, "utf8"),
      { knownTaskIds: lane.ownerTaskIds, lane: lane.name },
    );
    await writeFile(
      path.join(workspace.laneDirectory, "junit.xml"),
      junit,
      "utf8",
    );

    if (lane.name === "unit") {
      const coverage = normalizeLcovReport(
        await readFile(workspace.coverage, "utf8"),
        { repositoryRoot },
      );
      await writeFile(
        path.join(workspace.laneDirectory, "coverage.lcov"),
        coverage,
        "utf8",
      );
    }

    await rm(workspace.rawDirectory, { recursive: true });
  } catch {
    throw new Error("test-runner: report-failed");
  }
}

async function executeLane(laneName, environment, updateSnapshots) {
  const lane = resolveTestLane(laneName);
  const reportWorkspace = await createReportWorkspace(lane);
  const build = await runCommandProcess({
    arguments_: [
      ...packageManagerArguments,
      "exec",
      turboEntry,
      "run",
      "build",
      ...lane.buildFilters.map((filter) => `--filter=${filter}`),
    ],
    command: packageManagerCommand,
    environment,
    repositoryRoot,
    timeoutMs: lane.timeoutMs,
  });
  forward(build);
  if (build.code !== 0) {
    return build.code;
  }

  const files = await discoverLaneFiles(repositoryRoot, lane);
  if (lane.executor === "playwright") {
    const result = await runPlaywrightProcess({
      junitPath: reportWorkspace.junit,
      packageManagerArguments,
      packageManagerCommand,
      port: await reserveLoopbackPort(),
      repositoryRoot,
      sourceEnvironment: environment,
      timeoutMs: lane.timeoutMs,
      updateSnapshots,
    });
    forward(result);
    await finalizeReports(lane, reportWorkspace);
    return result.code;
  }

  const reporters = [
    { destination: "stdout", name: "spec" },
    { destination: reportWorkspace.junit, name: "junit" },
  ];
  if (lane.name === "unit") {
    reporters.push({ destination: reportWorkspace.coverage, name: "lcov" });
  }
  const result = await runTestProcess({
    concurrency: lane.concurrency,
    coverage:
      lane.name === "unit"
        ? {
            branches: 80,
            functions: 80,
            include: "packages/testing/dist/**/*.js",
            lines: 80,
          }
        : undefined,
    environment,
    files,
    reporters,
    repositoryRoot,
    timeoutMs: lane.timeoutMs,
  });
  forward(result);
  await finalizeReports(lane, reportWorkspace);
  return result.code;
}

export async function runSelectedLanes({
  laneNames,
  sourceEnvironment,
  updateSnapshots = false,
}) {
  if (
    !Array.isArray(laneNames) ||
    laneNames.length === 0 ||
    laneNames.some((laneName) => typeof laneName !== "string") ||
    typeof updateSnapshots !== "boolean" ||
    sourceEnvironment === null ||
    typeof sourceEnvironment !== "object"
  ) {
    throw new Error("test-runner: invalid-arguments");
  }
  const resolvedLaneNames = laneNames.map(
    (laneName) => resolveTestLane(laneName).name,
  );
  if (
    updateSnapshots &&
    (sourceEnvironment.CI === "true" ||
      sourceEnvironment.GITHUB_ACTIONS === "true" ||
      resolvedLaneNames.length !== 1 ||
      resolvedLaneNames[0] !== "e2e")
  ) {
    throw new Error("test-runner: snapshot-update-forbidden");
  }
  const environment = createChildEnvironment(sourceEnvironment);

  for (const laneName of resolvedLaneNames) {
    const code = await executeLane(laneName, environment, updateSnapshots);
    if (code !== 0) {
      return code;
    }
  }

  return 0;
}

function testRunnerErrorMessage(error) {
  return error instanceof Error && error.message.startsWith("test-runner:")
    ? error.message
    : "test-runner: unexpected-failure";
}

async function main() {
  if (process.argv.length !== 3) {
    throw new Error("test-runner: invalid-arguments");
  }

  const selected = process.argv[2];
  const laneNames =
    selected === "all"
      ? Object.keys(TEST_LANES)
      : [resolveTestLane(selected).name];
  process.exitCode = await runSelectedLanes({
    laneNames,
    sourceEnvironment: process.env,
  });
}

const isDirectInvocation =
  typeof process.argv[1] === "string" &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectInvocation) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`${testRunnerErrorMessage(error)}\n`);
    process.exitCode = 1;
  }
}
