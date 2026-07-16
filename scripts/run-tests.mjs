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
import { runCommandProcess, runTestProcess } from "./lib/test-process.mjs";
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

async function executeLane(laneName, environment) {
  const lane = resolveTestLane(laneName);
  const reportWorkspace = await createReportWorkspace(lane);
  const build = await runCommandProcess({
    arguments_: [
      turboEntry,
      "run",
      "build",
      ...lane.buildFilters.map((filter) => `--filter=${filter}`),
    ],
    command: process.execPath,
    environment,
    repositoryRoot,
    timeoutMs: lane.timeoutMs,
  });
  forward(build);
  if (build.code !== 0) {
    return build.code;
  }

  const files = await discoverLaneFiles(repositoryRoot, lane);
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

async function main() {
  if (process.argv.length !== 3) {
    throw new Error("test-runner: invalid-arguments");
  }

  const selected = process.argv[2];
  const laneNames =
    selected === "all"
      ? Object.keys(TEST_LANES)
      : [resolveTestLane(selected).name];
  const environment = createChildEnvironment(process.env);

  for (const laneName of laneNames) {
    const code = await executeLane(laneName, environment);
    if (code !== 0) {
      process.exitCode = code;
      return;
    }
  }
}

try {
  await main();
} catch (error) {
  const message =
    error instanceof Error && error.message.startsWith("test-runner:")
      ? error.message
      : "test-runner: unexpected-failure";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
