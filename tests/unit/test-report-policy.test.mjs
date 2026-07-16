import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import {
  normalizeJUnitReport,
  normalizeLcovReport,
  prepareTestReportArtifact,
  verifyTestReportArtifact,
} from "../../scripts/lib/test-report-policy.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

function junitWithRuntime(duration, root) {
  return `<?xml version="1.0" encoding="utf-8"?>
<testsuites>
  <testcase name="legacy case" time="${duration}" classname="test"/>
  <testcase name="QA-001:explicit-case" time="${duration}" classname="test" failure="failed">
    <failure type="testCodeFailure" message="failed">Error at ${root}/secret.test.mjs:1:1</failure>
  </testcase>
  <!-- tests 2 -->
  <!-- pass 1 -->
  <!-- fail 1 -->
  <!-- skipped 0 -->
  <!-- duration_ms ${duration} -->
</testsuites>
`;
}

test("QA-001:junit-normalization-removes-runtime-fields-and-stacks", () => {
  const first = normalizeJUnitReport(junitWithRuntime("0.014", "C:/repo"), {
    knownTaskIds: ["QA-001"],
    lane: "unit",
  });
  const second = normalizeJUnitReport(junitWithRuntime("0.991", "/repo"), {
    knownTaskIds: ["QA-001"],
    lane: "unit",
  });

  assert.equal(first, second);
  assert.match(first, /name="QA-001:explicit-case" time="0"/u);
  assert.match(first, /<failure message="test failed"\/>/u);
  assert.doesNotMatch(first, /duration|C:\/repo|\/repo|secret\.test/u);
});

test("QA-001:junit-normalization-rejects-malformed-duplicate-and-unknown-ids", async () => {
  const malformed = await readFile(
    path.join(
      repositoryRoot,
      "tests",
      "fixtures",
      "testing",
      "junit-malformed.xml",
    ),
    "utf8",
  );
  assert.throws(
    () =>
      normalizeJUnitReport(malformed, {
        knownTaskIds: ["QA-001"],
        lane: "unit",
      }),
    /test-report: invalid-junit/u,
  );

  const duplicate = junitWithRuntime("0.1", "/repo").replace(
    "legacy case",
    "QA-001:explicit-case",
  );
  assert.throws(
    () =>
      normalizeJUnitReport(duplicate, {
        knownTaskIds: ["QA-001"],
        lane: "unit",
      }),
    /test-report: duplicate-test-id/u,
  );
  assert.throws(
    () =>
      normalizeJUnitReport(
        junitWithRuntime("0.1", "/repo").replace(
          "QA-001:explicit-case",
          "BL-999:explicit-case",
        ),
        { knownTaskIds: ["QA-001"], lane: "unit" },
      ),
    /test-report: unknown-task-id/u,
  );
});

test("QA-001:lcov-normalization-is-relative-allowlisted-and-stable", () => {
  const sourcePath = path.join(
    repositoryRoot,
    "packages",
    "testing",
    "dist",
    "index.js",
  );
  const absolute = `TN:\nSF:${sourcePath}\nDA:2,1\nDA:1,1\nLF:2\nLH:2\nend_of_record\n`;
  const relative =
    "TN:\nSF:packages/testing/dist/index.js\nDA:2,1\nDA:1,1\nLF:2\nLH:2\nend_of_record\n";

  assert.equal(
    normalizeLcovReport(absolute, { repositoryRoot }),
    normalizeLcovReport(relative, { repositoryRoot }),
  );
  assert.throws(
    () =>
      normalizeLcovReport("TN:\nSF:../outside.js\nend_of_record\n", {
        repositoryRoot,
      }),
    /test-report: invalid-lcov-path/u,
  );
});

test("QA-001:test-report-artifact-is-hashed-reproducible-and-verifiable", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dnd-ai-reports-"));
  const laneDirectory = path.join(
    root,
    "test-results",
    "testing-foundation-v1",
    "unit",
  );
  await mkdir(laneDirectory, { recursive: true });
  await writeFile(
    path.join(laneDirectory, "junit.xml"),
    normalizeJUnitReport(junitWithRuntime("0.1", "/repo"), {
      knownTaskIds: ["QA-001"],
      lane: "unit",
    }),
    "utf8",
  );
  await writeFile(
    path.join(laneDirectory, "coverage.lcov"),
    "TN:\nSF:packages/testing/dist/index.js\nDA:1,1\nLF:1\nLH:1\nend_of_record\n",
    "utf8",
  );

  const options = {
    commit: "a".repeat(40),
    repositoryRoot: root,
    requiredLanes: ["unit"],
  };
  const first = await prepareTestReportArtifact(options);
  const second = await prepareTestReportArtifact(options);

  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, "testing-foundation-v1");
  assert.deepEqual(first.lanes, ["unit"]);
  assert.deepEqual(first.taskIds, ["QA-001"]);
  assert.deepEqual(await verifyTestReportArtifact(options), []);

  const persisted = JSON.parse(
    await readFile(
      path.join(root, "artifacts", "testing", "manifest.json"),
      "utf8",
    ),
  );
  assert.deepEqual(persisted, first);
});
