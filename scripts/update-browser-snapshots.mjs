import { runSelectedLanes } from "./run-tests.mjs";

function testRunnerErrorMessage(error) {
  return error instanceof Error && error.message.startsWith("test-runner:")
    ? error.message
    : "test-runner: unexpected-failure";
}

try {
  if (process.argv.length !== 2) {
    throw new Error("test-runner: invalid-arguments");
  }
  process.exitCode = await runSelectedLanes({
    laneNames: ["e2e"],
    sourceEnvironment: process.env,
    updateSnapshots: true,
  });
} catch (error) {
  process.stderr.write(`${testRunnerErrorMessage(error)}\n`);
  process.exitCode = 1;
}
