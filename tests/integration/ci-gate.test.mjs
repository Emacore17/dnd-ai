import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const gateScript = path.join(
  repositoryRoot,
  "scripts",
  "assert-ci-results.mjs",
);

function runGate(overrides = {}) {
  const environment = {
    ...process.env,
    QUALITY_RESULT: "success",
    TESTS_RESULT: "success",
    SECURITY_RESULT: "success",
    BUILD_RESULT: "success",
    ...overrides,
  };
  delete environment.NODE_TEST_CONTEXT;

  return spawnSync(process.execPath, [gateScript], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: environment,
  });
}

test("the merge gate propagates success and failure exit codes", () => {
  assert.equal(runGate().status, 0);

  const failure = runGate({ TESTS_RESULT: "failure" });
  assert.equal(failure.status, 1);
  assert.match(failure.stderr, /tests finished with failure/);
});

test("the intentionally failing fixture remains outside normal suites and exits one", () => {
  const fixturePath = path.join(
    repositoryRoot,
    "tests",
    "fixtures",
    "ci",
    "failing.test.mjs",
  );
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ["--test", fixturePath], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: environment,
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /BL-002 intentional failure fixture/);
});

test("the real CI policy and tracked-file secret scan commands pass", () => {
  for (const scriptName of ["check-ci-workflow.mjs", "scan-secrets.mjs"]) {
    const result = spawnSync(
      process.execPath,
      [path.join(repositoryRoot, "scripts", scriptName)],
      { cwd: repositoryRoot, encoding: "utf8" },
    );

    assert.equal(result.status, 0, `${scriptName}: ${result.stderr}`);
  }
});
