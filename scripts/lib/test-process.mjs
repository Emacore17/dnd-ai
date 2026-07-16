import { Buffer } from "node:buffer";
import { execFile, spawn } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { clearTimeout, setTimeout } from "node:timers";

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

export async function runTestProcess({
  concurrency,
  environment,
  files,
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

  return runCommandProcess({
    arguments_: [
      "--test",
      `--test-concurrency=${concurrency}`,
      "--test-isolation=process",
      ...files,
    ],
    command: process.execPath,
    environment,
    repositoryRoot,
    timeoutMs,
  });
}
