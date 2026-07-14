import { execFile, spawn } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_TEXT_FILE_BYTES = 10 * 1024 * 1024;
const CREDENTIAL_FILE_PATTERN = /\.(?:der|jks|key|keystore|p12|pfx|pem)$/i;
const SECRET_RULES = Object.freeze([
  {
    id: "private-key",
    expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    id: "github-token",
    expression: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g,
  },
  {
    id: "github-fine-grained-token",
    expression: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g,
  },
  {
    id: "npm-access-token",
    expression: /\bnpm_[A-Za-z0-9]{30,}\b/g,
  },
  {
    id: "aws-access-key",
    expression: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  },
  {
    id: "openai-api-key",
    expression: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}\b/g,
  },
  {
    id: "google-api-key",
    expression: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    id: "slack-token",
    expression: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g,
  },
]);

function lineNumberAt(text, index) {
  let line = 1;

  for (let position = 0; position < index; position += 1) {
    if (text.charCodeAt(position) === 10) {
      line += 1;
    }
  }

  return line;
}

function isPrivateEnvironmentFile(filePath) {
  const normalizedPath = filePath.replaceAll("\\", "/").toLowerCase();
  const fileName = path.posix.basename(normalizedPath);

  return (
    fileName === ".env" ||
    (fileName.startsWith(".env.") && fileName !== ".env.example")
  );
}

export function scanSecretText(text, filePath) {
  if (isPrivateEnvironmentFile(filePath)) {
    return [{ filePath, line: 1, ruleId: "environment-file" }];
  }

  const findings = [];

  for (const rule of SECRET_RULES) {
    rule.expression.lastIndex = 0;

    for (const match of text.matchAll(rule.expression)) {
      findings.push({
        filePath,
        line: lineNumberAt(text, match.index),
        ruleId: rule.id,
      });
    }
  }

  return findings.sort((left, right) =>
    `${left.filePath}:${left.line}:${left.ruleId}`.localeCompare(
      `${right.filePath}:${right.line}:${right.ruleId}`,
    ),
  );
}

export function scanSecretBuffer(buffer, filePath) {
  if (isPrivateEnvironmentFile(filePath)) {
    return [{ filePath, line: 1, ruleId: "environment-file" }];
  }

  if (CREDENTIAL_FILE_PATTERN.test(filePath)) {
    return [{ filePath, line: 1, ruleId: "credential-file" }];
  }

  if (buffer.subarray(0, 8_192).includes(0)) {
    return [];
  }

  if (buffer.byteLength > MAX_TEXT_FILE_BYTES) {
    return [{ filePath, line: 1, ruleId: "unscanned-large-text" }];
  }

  return scanSecretText(buffer.toString("utf8"), filePath);
}

export function formatSecretFinding(finding) {
  return `${finding.filePath}:${finding.line} ${finding.ruleId}`;
}

function isInside(parentDirectory, candidatePath) {
  const relativePath = path.relative(parentDirectory, candidatePath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${path.sep}`) && relativePath !== "..")
  );
}

export async function listRepositoryFiles(repositoryRoot) {
  const { stdout } = await execFileAsync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    {
      cwd: repositoryRoot,
      encoding: "buffer",
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  const gitFiles = stdout.toString("utf8").split("\0").filter(Boolean);
  const nonRegularEntries =
    await listUnignoredNonRegularEntries(repositoryRoot);

  return [...new Set([...gitFiles, ...nonRegularEntries])].sort();
}

async function listIgnoredPaths(repositoryRoot, relativePaths) {
  const ignoredPaths = new Set();
  const batchSize = 200;

  for (let offset = 0; offset < relativePaths.length; offset += batchSize) {
    const batch = relativePaths.slice(offset, offset + batchSize);

    for (const ignoredPath of (await runGitCheckIgnore(repositoryRoot, batch))
      .split("\0")
      .filter(Boolean)) {
      ignoredPaths.add(ignoredPath.replaceAll(path.sep, "/"));
    }
  }

  return ignoredPaths;
}

function runGitCheckIgnore(repositoryRoot, relativePaths) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "git",
      ["check-ignore", "--no-index", "-z", "--stdin"],
      { cwd: repositoryRoot, stdio: ["pipe", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    let settled = false;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    const fail = (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    child.on("error", fail);
    child.stdin.on("error", fail);
    child.on("close", (code) => {
      if (settled) {
        return;
      }

      settled = true;

      if (code === 0 || code === 1) {
        resolve(stdout);
        return;
      }

      reject(
        new Error(
          `git check-ignore failed with exit code ${code}: ${stderr.trim()}`,
        ),
      );
    });
    child.stdin.end(`${relativePaths.join("\0")}\0`, "utf8");
  });
}

async function listUnignoredNonRegularEntries(repositoryRoot) {
  const nonRegularEntries = [];

  async function walk(relativeDirectory) {
    const directoryPath = path.join(repositoryRoot, relativeDirectory);
    let entries;

    try {
      entries = await readdir(directoryPath, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") {
        return;
      }

      throw error;
    }

    const candidates = entries
      .filter((entry) => entry.name !== ".git")
      .map((entry) => ({
        entry,
        relativePath: path
          .join(relativeDirectory, entry.name)
          .replaceAll(path.sep, "/"),
      }));
    const ignoredPaths = await listIgnoredPaths(
      repositoryRoot,
      candidates.map(({ relativePath }) => relativePath),
    );

    for (const { entry, relativePath } of candidates) {
      if (ignoredPaths.has(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(relativePath);
      } else if (!entry.isFile()) {
        nonRegularEntries.push(relativePath);
      }
    }
  }

  await walk("");
  return nonRegularEntries;
}

export async function scanRepositoryFiles(repositoryRoot) {
  const findings = [];

  for (const relativePath of await listRepositoryFiles(repositoryRoot)) {
    const normalizedRelativePath = relativePath.replaceAll(path.sep, "/");
    const filePath = path.resolve(repositoryRoot, relativePath);

    if (!isInside(repositoryRoot, filePath)) {
      throw new Error(`repository path escapes root: ${relativePath}`);
    }

    if (isPrivateEnvironmentFile(normalizedRelativePath)) {
      findings.push({
        filePath: normalizedRelativePath,
        line: 1,
        ruleId: "environment-file",
      });
      continue;
    }

    if (CREDENTIAL_FILE_PATTERN.test(normalizedRelativePath)) {
      findings.push({
        filePath: normalizedRelativePath,
        line: 1,
        ruleId: "credential-file",
      });
      continue;
    }

    let buffer;

    try {
      const fileStat = await lstat(filePath);

      if (fileStat.isSymbolicLink()) {
        findings.push({
          filePath: normalizedRelativePath,
          line: 1,
          ruleId: "symbolic-link",
        });
        continue;
      }

      if (!fileStat.isFile()) {
        findings.push({
          filePath: normalizedRelativePath,
          line: 1,
          ruleId: "non-regular-file",
        });
        continue;
      }

      buffer = await readFile(filePath);
    } catch (error) {
      if (error.code === "ENOENT") {
        continue;
      }

      throw error;
    }

    findings.push(...scanSecretBuffer(buffer, normalizedRelativePath));
  }

  return findings;
}
