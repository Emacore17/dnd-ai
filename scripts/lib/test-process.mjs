import { Buffer } from "node:buffer";
import { execFile, spawn } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { clearTimeout, setTimeout } from "node:timers";

import { assertOwnedPathChain } from "./owned-path-policy.mjs";

const MAX_CAPTURE_BYTES = 1024 * 1024;

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function appendBounded(current, chunk) {
  if (Buffer.byteLength(current) >= MAX_CAPTURE_BYTES) {
    return current;
  }

  const remainingBytes = MAX_CAPTURE_BYTES - Buffer.byteLength(current);
  return current + chunk.toString("utf8", 0, remainingBytes);
}

async function terminateProcessTree(child) {
  if (child.pid === undefined) {
    return;
  }

  if (process.platform === "win32") {
    await new Promise((resolve) => {
      execFile(
        "taskkill",
        ["/pid", String(child.pid), "/T", "/F"],
        { windowsHide: true },
        () => resolve(),
      );
    });
    return;
  }

  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

export function runCommandProcess({
  arguments_,
  command,
  environment,
  repositoryRoot,
  timeoutMs,
}) {
  if (
    typeof command !== "string" ||
    command.length === 0 ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 1_800_000
  ) {
    throw new Error("test-runner: invalid-process-options");
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, [...arguments_], {
      cwd: repositoryRoot,
      detached: process.platform !== "win32",
      env: environment,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stderr = "";
    let stdout = "";
    let timedOut = false;
    const timeout = setTimeout(async () => {
      timedOut = true;
      await terminateProcessTree(child);
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout = appendBounded(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = appendBounded(stderr, chunk);
    });
    child.on("error", () => {
      clearTimeout(timeout);
      reject(new Error("test-runner: spawn-failed"));
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      resolve(
        Object.freeze({
          code: timedOut ? 1 : (code ?? 1),
          signal: timedOut ? "timeout" : signal,
          stderr: timedOut ? "test-runner: timeout\n" : stderr,
          stdout,
          timedOut,
        }),
      );
    });
  });
}

async function validateTestFiles(repositoryRoot, files) {
  const resolvedRoot = await realpath(path.resolve(repositoryRoot));
  const testsRoot = await realpath(path.join(resolvedRoot, "tests"));

  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("test-runner: invalid-test-path");
  }

  for (const filePath of files) {
    const absolutePath = path.resolve(filePath);
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
  }
}

async function buildReporterArguments(repositoryRoot, reporters) {
  if (reporters === undefined) {
    return [];
  }
  if (
    !Array.isArray(reporters) ||
    reporters.length === 0 ||
    reporters.length > 3
  ) {
    throw new Error("test-runner: invalid-reporter-options");
  }

  const names = new Set();
  const destinations = new Set();
  const testResultsRoot = path.join(repositoryRoot, "test-results");
  const arguments_ = [];

  for (const reporter of reporters) {
    if (
      reporter === null ||
      typeof reporter !== "object" ||
      !["junit", "lcov", "spec"].includes(reporter.name) ||
      typeof reporter.destination !== "string" ||
      reporter.destination.length === 0 ||
      names.has(reporter.name) ||
      destinations.has(reporter.destination)
    ) {
      throw new Error("test-runner: invalid-reporter-options");
    }

    if (!["stdout", "stderr"].includes(reporter.destination)) {
      const destination = path.resolve(reporter.destination);
      if (!isInside(path.resolve(testResultsRoot), destination)) {
        throw new Error("test-runner: invalid-reporter-options");
      }
      try {
        await assertOwnedPathChain(repositoryRoot, destination, {
          allowMissing: true,
          finalType: "file",
        });
      } catch {
        throw new Error("test-runner: invalid-reporter-options");
      }
    }

    names.add(reporter.name);
    destinations.add(reporter.destination);
    arguments_.push(
      `--test-reporter=${reporter.name}`,
      `--test-reporter-destination=${reporter.destination}`,
    );
  }

  return arguments_;
}

function buildCoverageArguments(coverage) {
  if (coverage === undefined) {
    return [];
  }
  if (
    coverage === null ||
    typeof coverage !== "object" ||
    coverage.include !== "packages/testing/dist/**/*.js" ||
    ![coverage.branches, coverage.functions, coverage.lines].every(
      (threshold) =>
        Number.isSafeInteger(threshold) && threshold >= 0 && threshold <= 100,
    )
  ) {
    throw new Error("test-runner: invalid-coverage-options");
  }

  return [
    "--experimental-test-coverage",
    `--test-coverage-include=${coverage.include}`,
    `--test-coverage-branches=${coverage.branches}`,
    `--test-coverage-functions=${coverage.functions}`,
    `--test-coverage-lines=${coverage.lines}`,
  ];
}

export async function runTestProcess({
  concurrency,
  coverage,
  environment,
  files,
  reporters,
  repositoryRoot,
  timeoutMs,
}) {
  if (
    !Number.isSafeInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 32
  ) {
    throw new Error("test-runner: invalid-process-options");
  }

  await validateTestFiles(repositoryRoot, files);
  const reporterArguments = await buildReporterArguments(
    repositoryRoot,
    reporters,
  );
  const coverageArguments = buildCoverageArguments(coverage);

  return runCommandProcess({
    arguments_: [
      "--test",
      `--test-concurrency=${concurrency}`,
      "--test-isolation=process",
      ...coverageArguments,
      ...reporterArguments,
      ...files,
    ],
    command: process.execPath,
    environment,
    repositoryRoot,
    timeoutMs,
  });
}
