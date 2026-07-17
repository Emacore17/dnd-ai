import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  normalizeJUnitReport,
  prepareTestReportArtifact,
} from "../../scripts/lib/test-report-policy.mjs";

function validJUnit(name = "QA-001:safe-case") {
  return `<?xml version="1.0" encoding="utf-8"?>\n<testsuites>\n<testcase name="${name}" time="0" classname="test"/>\n</testsuites>\n`;
}

test("QA-001:test-reports-reject-secret-bearing-test-names", () => {
  assert.throws(
    () =>
      normalizeJUnitReport(
        validJUnit("postgresql://user:secret@example.invalid/database"),
        { knownTaskIds: ["QA-001"], lane: "unit" },
      ),
    /test-report: sensitive-content/u,
  );
});

test("QA-001:test-report-output-rejects-a-linked-artifact-parent", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dnd-ai-report-link-"));
  const outside = await mkdtemp(
    path.join(os.tmpdir(), "dnd-ai-report-outside-"),
  );
  const laneDirectory = path.join(
    root,
    "test-results",
    "testing-foundation-v1",
    "unit",
  );
  await mkdir(laneDirectory, { recursive: true });
  await writeFile(path.join(laneDirectory, "junit.xml"), validJUnit(), "utf8");
  await writeFile(
    path.join(laneDirectory, "coverage.lcov"),
    "TN:\nSF:packages/testing/dist/index.js\nDA:1,1\nLF:1\nLH:1\nend_of_record\n",
    "utf8",
  );

  try {
    await symlink(
      outside,
      path.join(root, "artifacts"),
      process.platform === "win32" ? "junction" : "dir",
    );
  } catch (error) {
    if (["EPERM", "EACCES"].includes(error.code)) {
      context.skip("directory links are not permitted on this host");
      return;
    }
    throw error;
  }

  await assert.rejects(
    prepareTestReportArtifact({
      commit: "a".repeat(40),
      repositoryRoot: root,
      requiredLanes: ["unit"],
    }),
    /symbolic link|junction/u,
  );
});

test("QA-002:browser-report-artifact-excludes-raw-output-and-remote-urls", async (context) => {
  assert.throws(
    () =>
      normalizeJUnitReport(validJUnit("https://example.invalid/result"), {
        knownTaskIds: ["QA-002"],
        lane: "e2e",
      }),
    /test-report: remote-content/u,
  );

  const root = await mkdtemp(path.join(os.tmpdir(), "dnd-ai-e2e-report-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  const laneDirectory = path.join(
    root,
    "test-results",
    "testing-foundation-v1",
    "e2e",
  );
  await mkdir(laneDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(laneDirectory, "junit.xml"),
      validJUnit("QA-002:safe-browser-case"),
      "utf8",
    ),
    writeFile(path.join(laneDirectory, "trace.zip"), "trace", "utf8"),
    writeFile(path.join(laneDirectory, "video.webm"), "video", "utf8"),
    writeFile(path.join(laneDirectory, "axe.json"), "{}", "utf8"),
    writeFile(path.join(laneDirectory, ".env"), "SECRET=value", "utf8"),
  ]);

  const manifest = await prepareTestReportArtifact({
    commit: "b".repeat(40),
    repositoryRoot: root,
    requiredLanes: ["e2e"],
  });
  assert.deepEqual(
    manifest.files.map(({ path: filePath }) => filePath),
    ["e2e/junit.xml"],
  );
  assert.deepEqual(
    await readdir(path.join(root, "artifacts", "testing", "e2e")),
    ["junit.xml"],
  );
  assert.doesNotMatch(
    await readFile(
      path.join(root, "artifacts", "testing", "e2e", "junit.xml"),
      "utf8",
    ),
    /trace|video|axe|SECRET/u,
  );
});
