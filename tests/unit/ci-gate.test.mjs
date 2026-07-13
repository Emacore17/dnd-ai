import assert from "node:assert/strict";
import test from "node:test";

import {
  REQUIRED_CI_JOBS,
  validateRequiredJobResults,
} from "../../scripts/lib/ci-gate.mjs";

test("the required CI fan-in accepts only all-success results", () => {
  const successResults = Object.fromEntries(
    REQUIRED_CI_JOBS.map((jobName) => [jobName, "success"]),
  );

  assert.deepEqual(validateRequiredJobResults(successResults), []);
});

test("failure, cancellation and skipped jobs fail the required fan-in", () => {
  for (const result of ["failure", "cancelled", "skipped"]) {
    const results = Object.fromEntries(
      REQUIRED_CI_JOBS.map((jobName) => [jobName, "success"]),
    );
    results.tests = result;

    assert.deepEqual(validateRequiredJobResults(results), [
      `tests finished with ${result}`,
    ]);
  }
});

test("a missing required job fails closed", () => {
  assert.ok(
    validateRequiredJobResults({}).every((error) =>
      error.endsWith("finished with missing"),
    ),
  );
});
