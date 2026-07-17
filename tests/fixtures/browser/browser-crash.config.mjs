import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

export default defineConfig({
  outputDir: path.join(
    repositoryRoot,
    "test-results/testing-foundation-v1/e2e/fixture-output/browser-crash",
  ),
  reporter: "line",
  retries: 0,
  testDir: ".",
  testMatch: "browser-crash.spec.mjs",
  timeout: 5_000,
  use: {
    browserName: "chromium",
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  workers: 1,
});
