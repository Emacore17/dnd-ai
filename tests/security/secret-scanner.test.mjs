import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  formatSecretFinding,
  listRepositoryFiles,
  scanSecretBuffer,
  scanSecretText,
} from "../../scripts/lib/secret-scanner.mjs";

const execFileAsync = promisify(execFile);

test("high-confidence synthetic credentials are detected without echoing values", () => {
  const syntheticToken = ["gh", "p_", "A".repeat(36)].join("");
  const findings = scanSecretText(`TOKEN=${syntheticToken}\n`, "fixture.env");

  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "github-token");
  assert.doesNotMatch(
    formatSecretFinding(findings[0]),
    new RegExp(syntheticToken),
  );
});

test("secret names and documented placeholders are not treated as credentials", () => {
  const text = [
    "OPENAI_API_KEY=<set-in-secret-manager>",
    "const tokenName = 'GITHUB_TOKEN';",
    "VERCEL_TOKEN=placeholder",
  ].join("\n");

  assert.deepEqual(scanSecretText(text, ".env.example"), []);
});

test("private keys and cloud access keys are rejected", () => {
  const privateKeyHeader = ["-----BEGIN ", "PRIVATE KEY-----"].join("");
  const awsKey = ["AKIA", "A".repeat(16)].join("");
  const findings = scanSecretText(
    `${privateKeyHeader}\n${awsKey}\n`,
    "fixture.txt",
  );

  assert.deepEqual(findings.map(({ ruleId }) => ruleId).sort(), [
    "aws-access-key",
    "private-key",
  ]);
});

test("current GitHub and npm supply-chain token prefixes are detected", () => {
  const githubToken = ["github", "_pat_", "A".repeat(48)].join("");
  const npmToken = ["npm", "_", "b".repeat(36)].join("");
  const findings = scanSecretText(
    `${githubToken}\n${npmToken}\n`,
    "fixture.txt",
  );

  assert.deepEqual(findings.map(({ ruleId }) => ruleId).sort(), [
    "github-fine-grained-token",
    "npm-access-token",
  ]);
});

test("credential files and oversized text fail closed", () => {
  assert.deepEqual(scanSecretBuffer(Buffer.from([0, 1, 2]), "signing.p12"), [
    { filePath: "signing.p12", line: 1, ruleId: "credential-file" },
  ]);
  assert.deepEqual(
    scanSecretBuffer(Buffer.alloc(10 * 1024 * 1024 + 1, 65), "bundle.js"),
    [
      {
        filePath: "bundle.js",
        line: 1,
        ruleId: "unscanned-large-text",
      },
    ],
  );
});

test("repository scan includes untracked non-ignored files", async (context) => {
  const repositoryRoot = await mkdtemp(
    path.join(tmpdir(), "dnd-ai-secret-scan-"),
  );
  context.after(() => rm(repositoryRoot, { force: true, recursive: true }));

  await execFileAsync("git", ["init", "--quiet"], { cwd: repositoryRoot });
  await writeFile(path.join(repositoryRoot, ".gitignore"), "ignored.txt\n");
  await writeFile(path.join(repositoryRoot, "tracked.txt"), "tracked\n");
  await execFileAsync("git", ["add", ".gitignore", "tracked.txt"], {
    cwd: repositoryRoot,
  });
  await writeFile(path.join(repositoryRoot, "untracked.txt"), "untracked\n");
  await writeFile(path.join(repositoryRoot, "ignored.txt"), "ignored\n");

  assert.deepEqual(await listRepositoryFiles(repositoryRoot), [
    ".gitignore",
    "tracked.txt",
    "untracked.txt",
  ]);
});
