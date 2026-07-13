import {
  REQUIRED_CI_JOBS,
  validateRequiredJobResults,
} from "./lib/ci-gate.mjs";

const environmentKeys = {
  quality: "QUALITY_RESULT",
  tests: "TESTS_RESULT",
  security: "SECURITY_RESULT",
  build: "BUILD_RESULT",
};
const results = Object.fromEntries(
  REQUIRED_CI_JOBS.map((jobName) => [
    jobName,
    process.env[environmentKeys[jobName]],
  ]),
);
const errors = validateRequiredJobResults(results);

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }

  process.exitCode = 1;
} else {
  console.log("ci-required-gate: PASS");
}
