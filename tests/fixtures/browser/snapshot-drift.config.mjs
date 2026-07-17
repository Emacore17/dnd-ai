import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

export default defineConfig({
  outputDir: path.join(
    repositoryRoot,
    "test-results/testing-foundation-v1/e2e/fixture-output/snapshot-drift",
  ),
  reporter: "line",
  retries: 0,
  snapshotPathTemplate: "{testDir}/{arg}",
  testDir: ".",
  testMatch: "snapshot-drift.spec.mjs",
  timeout: 5_000,
  updateSnapshots: "none",
  workers: 1,
});
