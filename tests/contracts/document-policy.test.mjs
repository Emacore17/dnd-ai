import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import {
  checkDocumentationRepository,
  discoverMarkdownDocuments,
  validateDocumentPolicy,
} from "../../scripts/lib/document-policy.mjs";

const execFileAsync = promisify(execFile);
const documentCliPath = fileURLToPath(
  new URL("../../scripts/check-docs.mjs", import.meta.url),
);

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function yamlList(name, values) {
  if (values.length === 0) {
    return `${name}: []`;
  }

  return [
    `${name}:`,
    ...values.map((value) => `  - ${JSON.stringify(value)}`),
  ].join("\n");
}

function livingDocument({
  status = "active",
  reviewed = "2026-07-14",
  verified = "unversioned",
  sourceRefs = [],
  relatedTasks = ["GOV-003"],
  codeRefs = [],
  testRefs = [],
  supersedes = null,
  body = "# Fixture\n",
} = {}) {
  return [
    "---",
    `status: ${status}`,
    "owner: engineering",
    `last_reviewed: ${reviewed}`,
    `last_verified_commit: ${verified}`,
    yamlList("source_refs", sourceRefs),
    yamlList("related_tasks", relatedTasks),
    yamlList("code_refs", codeRefs),
    yamlList("test_refs", testRefs),
    `supersedes: ${supersedes === null ? "null" : JSON.stringify(supersedes)}`,
    "---",
    "",
    body,
  ].join("\n");
}

async function createFixture(context) {
  const repositoryRoot = await mkdtemp(
    path.join(tmpdir(), "dnd-ai-document-policy-"),
  );
  context.after(() => rm(repositoryRoot, { force: true, recursive: true }));
  await Promise.all([
    mkdir(path.join(repositoryRoot, "docs", "adr"), { recursive: true }),
    mkdir(path.join(repositoryRoot, "src"), { recursive: true }),
    mkdir(path.join(repositoryRoot, "tests"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(repositoryRoot, "src", "runtime.mjs"), "\n", "utf8"),
    writeFile(
      path.join(repositoryRoot, "tests", "runtime.test.mjs"),
      "\n",
      "utf8",
    ),
  ]);
  return repositoryRoot;
}

async function writeFixtureDocument(repositoryRoot, relativePath, source) {
  const absolutePath = path.join(repositoryRoot, ...relativePath.split("/"));
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, source, "utf8");
}

function tasksDocument(options = {}) {
  return livingDocument({
    ...options,
    body: "# Tasks\n\n### GOV-003 — Documentation fixture\n",
  });
}

test("validates living metadata, repository refs, task IDs and relative links", async (context) => {
  const repositoryRoot = await createFixture(context);
  await Promise.all([
    writeFixtureDocument(
      repositoryRoot,
      "docs/TASKS.md",
      tasksDocument({ reviewed: "2026-07-13", verified: "aaaaaaa" }),
    ),
    writeFixtureDocument(
      repositoryRoot,
      "docs/README.md",
      livingDocument({
        verified: "deadbee",
        sourceRefs: ["docs/TASKS.md#tasks"],
        codeRefs: ["src"],
        testRefs: ["tests/runtime.test.mjs", "tests/future.test.mjs (planned)"],
        body: [
          "# Readme",
          "",
          "[Tasks](TASKS.md)",
          "[External](https://example.test/docs)",
          "",
        ].join("\n"),
      }),
    ),
    writeFixtureDocument(
      repositoryRoot,
      "docs/adr/0001-proposal.md",
      livingDocument({
        status: "proposed",
        reviewed: "2026-07-13",
        verified: "aaaaaaa",
        sourceRefs: ["docs/TASKS.md"],
      }),
    ),
  ]);

  const result = await validateDocumentPolicy({
    repositoryRoot,
    documentPaths: [
      "docs/TASKS.md",
      "docs/README.md",
      "docs/adr/0001-proposal.md",
    ],
    changedDocumentPaths: ["docs/README.md"],
    today: "2026-07-14",
    commitExists: async (commit) => commit === "deadbee",
  });

  assert.deepEqual(result, { errors: [], warnings: [] });
});

test("fails closed on stale metadata, unknown refs and broken Markdown links", async (context) => {
  const repositoryRoot = await createFixture(context);
  await Promise.all([
    writeFixtureDocument(repositoryRoot, "docs/TASKS.md", tasksDocument()),
    writeFixtureDocument(
      repositoryRoot,
      "docs/BROKEN.md",
      livingDocument({
        reviewed: "2026-07-15",
        verified: "badcafe",
        sourceRefs: ["docs/MISSING.md"],
        relatedTasks: ["BUG-999"],
        codeRefs: ["missing/module"],
        testRefs: ["tests/future.test.mjs (planned)"],
        body: [
          "# Broken",
          "",
          "A [missing document](missing.md) is planned.",
          "",
          "```md",
          "[ignored example](ignored.md)",
          "```",
          "Trailing whitespace.  ",
          "",
        ].join("\n"),
      }),
    ),
    writeFixtureDocument(
      repositoryRoot,
      "docs/NO_FRONTMATTER.md",
      "# No front matter\n",
    ),
    writeFixtureDocument(
      repositoryRoot,
      "docs/PROPOSAL.md",
      livingDocument({ status: "proposed" }),
    ),
    writeFixtureDocument(
      repositoryRoot,
      "docs/LEGACY.md",
      "# Legacy document without front matter\n",
    ),
  ]);

  const result = await validateDocumentPolicy({
    repositoryRoot,
    documentPaths: [
      "docs/TASKS.md",
      "docs/BROKEN.md",
      "docs/NO_FRONTMATTER.md",
      "docs/PROPOSAL.md",
      "docs/LEGACY.md",
    ],
    changedDocumentPaths: [
      "docs/BROKEN.md",
      "docs/NO_FRONTMATTER.md",
      "docs/PROPOSAL.md",
    ],
    today: "2026-07-14",
    commitExists: async () => false,
  });
  const { errors, warnings } = result;

  for (const expected of [
    "docs/BROKEN.md: future-last-reviewed",
    "docs/BROKEN.md: changed-last-reviewed-not-today",
    "docs/BROKEN.md: missing-source-ref docs/MISSING.md",
    "docs/BROKEN.md: unknown-related-task BUG-999",
    "docs/BROKEN.md: missing-code-ref missing/module",
    "docs/BROKEN.md: broken-relative-link missing.md",
    "docs/BROKEN.md: changed-last-verified-commit-missing badcafe",
    "docs/NO_FRONTMATTER.md: missing-front-matter",
    "docs/PROPOSAL.md: invalid-status proposed",
  ]) {
    assert.ok(errors.includes(expected), `${expected}\n${errors.join("\n")}`);
  }
  assert.equal(
    errors.some((error) => error.includes("ignored.md")),
    false,
  );
  assert.equal(
    errors.some((error) => error.includes("tests/future.test.mjs")),
    false,
  );
  assert.equal(
    errors.some((error) =>
      error.startsWith("docs/BROKEN.md: trailing-whitespace line "),
    ),
    true,
  );
  assert.deepEqual(warnings, ["docs/LEGACY.md: missing-front-matter"]);
});

test("discovers tracked and untracked Markdown and the CLI checks both passes", async (context) => {
  const repositoryRoot = await createFixture(context);
  const today = localDate();
  await Promise.all([
    writeFixtureDocument(
      repositoryRoot,
      "docs/TASKS.md",
      tasksDocument({ reviewed: today }),
    ),
    writeFixtureDocument(
      repositoryRoot,
      "docs/README.md",
      livingDocument({
        reviewed: today,
        sourceRefs: ["docs/TASKS.md"],
        body: "# Readme\n\n[Tasks](TASKS.md)\n",
      }),
    ),
    writeFixtureDocument(
      repositoryRoot,
      "docs/IGNORED.md",
      livingDocument({ reviewed: today }),
    ),
    writeFile(
      path.join(repositoryRoot, ".gitignore"),
      "docs/IGNORED.md\n",
      "utf8",
    ),
  ]);
  await execFileAsync("git", ["init", "--quiet"], { cwd: repositoryRoot });
  await execFileAsync("git", ["add", "."], { cwd: repositoryRoot });
  await execFileAsync(
    "git",
    [
      "-c",
      "user.name=Documentation Policy",
      "-c",
      "user.email=documentation-policy@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    ],
    { cwd: repositoryRoot },
  );
  await execFileAsync(
    "git",
    ["update-ref", "refs/remotes/origin/main", "HEAD"],
    { cwd: repositoryRoot },
  );
  await writeFile(
    path.join(repositoryRoot, "docs", "README.md"),
    `${livingDocument({
      reviewed: today,
      sourceRefs: ["docs/TASKS.md"],
      body: "# Readme changed\n\n[Tasks](TASKS.md)\n",
    })}`,
    "utf8",
  );
  await execFileAsync("git", ["add", "docs/README.md"], {
    cwd: repositoryRoot,
  });
  await execFileAsync(
    "git",
    [
      "-c",
      "user.name=Documentation Policy",
      "-c",
      "user.email=documentation-policy@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "changed tracked documentation",
    ],
    { cwd: repositoryRoot },
  );
  await writeFixtureDocument(
    repositoryRoot,
    "docs/NEW.md",
    livingDocument({ reviewed: today, sourceRefs: ["docs/TASKS.md"] }),
  );

  const discovery = await discoverMarkdownDocuments(repositoryRoot);
  assert.deepEqual(discovery.documentPaths, [
    "docs/NEW.md",
    "docs/README.md",
    "docs/TASKS.md",
  ]);
  assert.deepEqual(discovery.changedDocumentPaths, [
    "docs/NEW.md",
    "docs/README.md",
  ]);

  const result = await checkDocumentationRepository(repositoryRoot, { today });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);

  const cli = await execFileAsync(
    process.execPath,
    [documentCliPath, "--root", repositoryRoot],
    { cwd: repositoryRoot },
  );
  assert.match(
    cli.stdout,
    /documentation-policy: PASS \(3 documents, 2 changed\)/u,
  );
  assert.equal(cli.stderr, "");
});
