import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
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

export function scanSecretText(text, filePath) {
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

  return stdout.toString("utf8").split("\0").filter(Boolean).sort();
}

export async function scanRepositoryFiles(repositoryRoot) {
  const findings = [];

  for (const relativePath of await listRepositoryFiles(repositoryRoot)) {
    const filePath = path.resolve(repositoryRoot, relativePath);

    if (!isInside(repositoryRoot, filePath)) {
      throw new Error(`repository path escapes root: ${relativePath}`);
    }

    const buffer = await readFile(filePath);
    findings.push(
      ...scanSecretBuffer(buffer, relativePath.replaceAll(path.sep, "/")),
    );
  }

  return findings;
}
