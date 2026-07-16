import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath, URL } from "node:url";

import { verifyTestReportArtifact } from "./lib/test-report-policy.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

function parseRequiredLanes() {
  if (process.argv.length !== 3 || !process.argv[2].startsWith("--required=")) {
    throw new Error("test-report-cli: invalid-arguments");
  }

  const requiredLanes = process.argv[2].slice("--required=".length).split(",");
  if (requiredLanes.some((lane) => lane.length === 0 || lane.trim() !== lane)) {
    throw new Error("test-report-cli: invalid-arguments");
  }

  return requiredLanes;
}

async function resolveCommit() {
  if (typeof process.env.GITHUB_SHA === "string") {
    return process.env.GITHUB_SHA.toLowerCase();
  }

  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  return stdout.trim().toLowerCase();
}

try {
  const errors = await verifyTestReportArtifact({
    commit: await resolveCommit(),
    repositoryRoot,
    requiredLanes: parseRequiredLanes(),
  });
  if (errors.length > 0) {
    for (const error of errors) {
      process.stderr.write(`${error}\n`);
    }
    process.exitCode = 1;
  } else {
    process.stdout.write("test-report: verified\n");
  }
} catch {
  process.stderr.write("test-report-cli: verify-failed\n");
  process.exitCode = 1;
}
