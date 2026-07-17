import { fileURLToPath, URL } from "node:url";

import { createChildEnvironment } from "../../scripts/lib/test-lane-policy.mjs";
import { runCommandProcess } from "../../scripts/lib/test-process.mjs";
import { expect, test } from "./browser-fixture.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const playwrightCli = fileURLToPath(
  import.meta.resolve("@playwright/test/cli"),
);
const fixtureCases = Object.freeze([
  {
    config: "tests/fixtures/browser/server-not-ready.config.mjs",
    expected: /browser-fixture: server-exited/u,
    name: "server-not-ready",
  },
  {
    config: "tests/fixtures/browser/browser-crash.config.mjs",
    expected: /Target page, context or browser has been closed/u,
    name: "browser-crash",
  },
  {
    config: "tests/fixtures/browser/snapshot-drift.config.mjs",
    expected: /snapshot-drift\.txt/u,
    name: "snapshot-drift",
  },
]);

for (const fixtureCase of fixtureCases) {
  test(`QA-002:harness-observes-${fixtureCase.name}-failure`, async () => {
    const result = await runCommandProcess({
      arguments_: [
        playwrightCli,
        "test",
        `--config=${fixtureCase.config}`,
        "--update-snapshots=none",
      ],
      command: process.execPath,
      environment: createChildEnvironment(process.env),
      repositoryRoot,
      timeoutMs: 15_000,
    });
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.timedOut, `${fixtureCase.name} fixture timeout`).toBe(false);
    expect(result.code, `${fixtureCase.name} fixture exit`).not.toBe(0);
    expect(output, `${fixtureCase.name} failure marker`).toMatch(
      fixtureCase.expected,
    );
  });
}
