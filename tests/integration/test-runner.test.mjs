import assert from "node:assert/strict";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import { createChildEnvironment } from "../../scripts/lib/test-lane-policy.mjs";
import { runTestProcess } from "../../scripts/lib/test-process.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixtureRoot = path.join(repositoryRoot, "tests", "fixtures", "testing");

function fixture(name) {
  return path.join(fixtureRoot, name);
}

test("QA-001:test-process-propagates-green-and-red-exit-codes", async () => {
  const passing = await runTestProcess({
    concurrency: 1,
    environment: createChildEnvironment(process.env),
    files: [fixture("passing.test.mjs")],
    repositoryRoot,
    timeoutMs: 5_000,
  });
  assert.equal(passing.code, 0);
  assert.equal(passing.timedOut, false);

  const failing = await runTestProcess({
    concurrency: 1,
    environment: createChildEnvironment(process.env),
    files: [fixture("failing.test.mjs")],
    repositoryRoot,
    timeoutMs: 5_000,
  });
  assert.equal(failing.code, 1);
  assert.match(failing.stdout, /QA-001:runner-failing-fixture/u);
});

test("QA-001:test-process-uses-distinct-file-processes", async () => {
  const result = await runTestProcess({
    concurrency: 1,
    environment: createChildEnvironment(process.env),
    files: [fixture("isolation-a.test.mjs"), fixture("isolation-b.test.mjs")],
    repositoryRoot,
    timeoutMs: 5_000,
  });
  const processIds = [...result.stdout.matchAll(/RUNNER_PID:(\d+)/gu)].map(
    (match) => match[1],
  );

  assert.equal(result.code, 0);
  assert.equal(processIds.length, 2);
  assert.equal(new Set(processIds).size, 2);
});

test("QA-001:test-process-drops-secret-bearing-environment", async () => {
  const result = await runTestProcess({
    concurrency: 1,
    environment: createChildEnvironment({
      ...process.env,
      APP_SECRET: "must-not-pass",
      DATABASE_URL: "postgresql://user:password@example.invalid/database",
      NODE_OPTIONS: "--inspect",
      REDIS_URL: "redis://user:password@example.invalid/0",
    }),
    files: [fixture("environment.test.mjs")],
    repositoryRoot,
    timeoutMs: 5_000,
  });

  assert.equal(result.code, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /must-not-pass|password@example/iu);
  assert.doesNotMatch(result.stderr, /must-not-pass|password@example/iu);
});

test("QA-001:test-process-times-out-with-a-static-error", async () => {
  const result = await runTestProcess({
    concurrency: 1,
    environment: createChildEnvironment(process.env),
    files: [fixture("hanging.test.mjs")],
    repositoryRoot,
    timeoutMs: 300,
  });

  assert.equal(result.code, 1);
  assert.equal(result.timedOut, true);
  assert.equal(result.stderr, "test-runner: timeout\n");
});

test("QA-001:test-process-rejects-files-outside-the-tests-root", async () => {
  await assert.rejects(
    runTestProcess({
      concurrency: 1,
      environment: createChildEnvironment(process.env),
      files: [path.join(repositoryRoot, "package.json")],
      repositoryRoot,
      timeoutMs: 5_000,
    }),
    /test-runner: invalid-test-path/u,
  );
});

test("QA-001:test-process-emits-junit-to-an-owned-destination", async () => {
  const rawDirectory = path.join(
    repositoryRoot,
    "test-results",
    "testing-foundation-v1",
    "integration",
    "raw",
  );
  const junitPath = path.join(rawDirectory, "runner-fixture.xml");
  await mkdir(rawDirectory, { recursive: true });

  try {
    const result = await runTestProcess({
      concurrency: 1,
      environment: createChildEnvironment(process.env),
      files: [fixture("passing.test.mjs")],
      reporters: [
        { destination: "stdout", name: "spec" },
        { destination: junitPath, name: "junit" },
      ],
      repositoryRoot,
      timeoutMs: 5_000,
    });

    assert.equal(result.code, 0, result.stderr);
    assert.match(
      await readFile(junitPath, "utf8"),
      /QA-001:runner-passing-fixture/u,
    );
  } finally {
    await rm(junitPath, { force: true });
  }
});
