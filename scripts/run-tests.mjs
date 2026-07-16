import path from "node:path";
import { fileURLToPath, URL } from "node:url";

import {
  TEST_LANES,
  createChildEnvironment,
  discoverLaneFiles,
  resolveTestLane,
} from "./lib/test-lane-policy.mjs";
import { runCommandProcess, runTestProcess } from "./lib/test-process.mjs";

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

async function executeLane(laneName, environment) {
  const lane = resolveTestLane(laneName);
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
  const result = await runTestProcess({
    concurrency: lane.concurrency,
    environment,
    files,
    repositoryRoot,
    timeoutMs: lane.timeoutMs,
  });
  forward(result);
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
