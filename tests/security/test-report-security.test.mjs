import assert from "node:assert/strict";
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
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
