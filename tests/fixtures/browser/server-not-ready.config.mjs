import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

export default defineConfig({
  outputDir: path.join(
    repositoryRoot,
    "test-results/testing-foundation-v1/e2e/fixture-output/server-not-ready",
  ),
  reporter: "line",
  retries: 0,
  testDir: ".",
  testMatch: "server-not-ready.spec.mjs",
  timeout: 5_000,
  use: { screenshot: "off", trace: "off", video: "off" },
  webServer: {
    command: "node tests/fixtures/browser/server-exits.mjs",
    cwd: repositoryRoot,
    reuseExistingServer: false,
    stderr: "pipe",
    stdout: "ignore",
    timeout: 2_000,
    url: "http://127.0.0.1:9/health",
  },
  workers: 1,
});
