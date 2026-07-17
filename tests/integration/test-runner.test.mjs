import assert from "node:assert/strict";
import { createServer } from "node:net";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import { createChildEnvironment } from "../../scripts/lib/test-lane-policy.mjs";
import {
  runCommandProcess,
  runTestProcess,
} from "../../scripts/lib/test-process.mjs";

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

test("QA-002:playwright-invocation-is-bounded-loopback-and-redacted", async () => {
  const testProcess = await import("../../scripts/lib/test-process.mjs");
  assert.equal(typeof testProcess.createPlaywrightInvocation, "function");
  const rawDirectory = path.join(
    repositoryRoot,
    "test-results",
    "testing-foundation-v1",
    "e2e",
    "raw",
  );
  const junitPath = path.join(rawDirectory, "junit.xml");
  await mkdir(rawDirectory, { recursive: true });

  try {
    const invocation = await testProcess.createPlaywrightInvocation({
      junitPath,
      packageManagerArguments: ["corepack-entry", "pnpm@11.13.0"],
      packageManagerCommand: "node-command",
      port: 41_023,
      repositoryRoot,
      sourceEnvironment: {
        CI: "true",
        DATABASE_URL: "postgresql://user:password@example.invalid/database",
        PATH: "safe-path",
      },
      timeoutMs: 300_000,
      updateSnapshots: false,
    });

    assert.equal(invocation.command, "node-command");
    assert.deepEqual(invocation.arguments_, [
      "corepack-entry",
      "pnpm@11.13.0",
      "exec",
      "playwright",
      "test",
      "--config=tests/e2e/playwright.config.mjs",
      "--update-snapshots=none",
    ]);
    assert.deepEqual(invocation.environment, {
      CI: "true",
      HOSTNAME: "127.0.0.1",
      PATH: "safe-path",
      PLAYWRIGHT_JUNIT_OUTPUT_FILE: junitPath,
      PORT: "41023",
    });
    assert.equal(invocation.repositoryRoot, repositoryRoot);
    assert.equal(invocation.timeoutMs, 300_000);
  } finally {
    await rm(rawDirectory, { force: true, recursive: true });
  }
});

test("QA-002:reserved-browser-port-is-released-before-the-run", async () => {
  const testProcess = await import("../../scripts/lib/test-process.mjs");
  assert.equal(typeof testProcess.reserveLoopbackPort, "function");
  const port = await testProcess.reserveLoopbackPort();
  assert.ok(Number.isSafeInteger(port));
  assert.ok(port >= 1_024 && port <= 65_535);

  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("QA-002:snapshot-update-wrapper-fails-closed-in-ci", async () => {
  const result = await runCommandProcess({
    arguments_: [
      path.join(repositoryRoot, "scripts", "update-browser-snapshots.mjs"),
    ],
    command: process.execPath,
    environment: createChildEnvironment({ ...process.env, CI: "true" }),
    repositoryRoot,
    timeoutMs: 5_000,
  });

  assert.equal(result.code, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "test-runner: snapshot-update-forbidden\n");
});
