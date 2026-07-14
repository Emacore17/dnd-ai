import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

import {
  createChangedFileSelection,
  planAffectedVerification,
} from "./lib/affected-verification.mjs";

const TURBO_ARGUMENTS = ["run", "lint", "typecheck", "build", "--affected"];

function resolveRoot(args) {
  if (args.length === 0) {
    return fileURLToPath(new URL("../", import.meta.url));
  }

  if (args.length !== 2 || args[0] !== "--root" || !args[1]) {
    throw new Error("usage: node scripts/verify-affected.mjs [--root <path>]");
  }

  return path.resolve(args[1]);
}

function runProcess(
  command,
  args,
  { cwd, allowFailure = false, inherit = false },
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    if (!inherit) {
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
    }

    child.once("error", reject);
    child.once("close", (code, signal) => {
      const result = { code, signal, stderr, stdout };

      if (code === 0 || allowFailure) {
        resolve(result);
        return;
      }

      const detail = stderr.trim() || stdout.trim() || `signal ${signal}`;
      reject(
        new Error(
          `${command} ${args.join(" ")} exited with ${code}: ${detail}`,
        ),
      );
    });
  });
}

async function collectChangedFiles(rootDirectory) {
  const [unstaged, staged, untracked, mergeBaseResult] = await Promise.all([
    runProcess("git", ["diff", "--name-only", "-z", "--"], {
      cwd: rootDirectory,
    }),
    runProcess("git", ["diff", "--cached", "--name-only", "-z", "--"], {
      cwd: rootDirectory,
    }),
    runProcess("git", ["ls-files", "--others", "--exclude-standard", "-z"], {
      cwd: rootDirectory,
    }),
    runProcess("git", ["merge-base", "HEAD", "origin/main"], {
      allowFailure: true,
      cwd: rootDirectory,
    }),
  ]);
  const localOutputs = [unstaged.stdout, staged.stdout, untracked.stdout];
  const mergeBase =
    mergeBaseResult.code === 0 ? mergeBaseResult.stdout.trim() : null;
  let mergeBaseDifferenceOutput = "";

  if (mergeBase) {
    const mergeBaseDifference = await runProcess(
      "git",
      ["diff", "--name-only", "-z", mergeBase, "--"],
      { cwd: rootDirectory },
    );
    mergeBaseDifferenceOutput = mergeBaseDifference.stdout;
  }

  return createChangedFileSelection({
    localOutputs,
    mergeBase,
    mergeBaseDifferenceOutput,
  });
}

async function readTurboPlan(rootDirectory, turboCliPath) {
  const dryRun = await runProcess(
    process.execPath,
    [turboCliPath, ...TURBO_ARGUMENTS, "--dry=json"],
    { cwd: rootDirectory },
  );

  try {
    return JSON.parse(dryRun.stdout);
  } catch (error) {
    throw new Error("verify:affected: Turbo dry-run returned invalid JSON", {
      cause: error,
    });
  }
}

async function main() {
  const rootDirectory = resolveRoot(process.argv.slice(2));
  const turboCliPath = fileURLToPath(import.meta.resolve("turbo"));
  const selection = await collectChangedFiles(rootDirectory);
  const mergeBaseLabel = selection.mergeBase ?? "unavailable";

  console.log(
    `verify:affected: found ${selection.files.length} changed file(s); discovery: ${selection.discoveryMode}; origin/main merge-base: ${mergeBaseLabel}`,
  );

  const turboPlan = await readTurboPlan(rootDirectory, turboCliPath);
  const decision = planAffectedVerification({
    changedFiles: selection.files,
    turboPlan,
  });

  console.log(decision.message);

  if (decision.action === "skip-turbo") {
    return;
  }

  await runProcess(process.execPath, [turboCliPath, ...TURBO_ARGUMENTS], {
    cwd: rootDirectory,
    inherit: true,
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
