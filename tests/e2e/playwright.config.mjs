import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const port = Number.parseInt(process.env.PORT ?? "", 10);
const junitOutputFile = process.env.PLAYWRIGHT_JUNIT_OUTPUT_FILE;

if (!Number.isSafeInteger(port) || port < 1_024 || port > 65_535) {
  throw new Error("browser-harness: invalid-port");
}
if (typeof junitOutputFile !== "string" || junitOutputFile.length === 0) {
  throw new Error("browser-harness: missing-junit-output");
}

const baseURL = `http://127.0.0.1:${port}`;
const standaloneServerPath = "apps/web/.next/standalone/apps/web/server.js";

export default defineConfig({
  expect: { timeout: 5_000 },
  forbidOnly: true,
  fullyParallel: false,
  outputDir: path.join(
    repositoryRoot,
    "test-results/testing-foundation-v1/e2e/playwright-output",
  ),
  reporter: [["list"], ["junit", { outputFile: junitOutputFile }]],
  retries: 0,
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{platform}/{testFileName}/{arg}{ext}",
  testDir: ".",
  testMatch: "*.spec.mjs",
  timeout: 30_000,
  updateSnapshots: "none",
  use: {
    baseURL,
    colorScheme: "dark",
    locale: "it-IT",
    screenshot: "off",
    timezoneId: "Europe/Rome",
    trace: "off",
    video: "off",
  },
  webServer: {
    command: "node tests/e2e/start-web-server.mjs",
    cwd: repositoryRoot,
    env: {
      ...process.env,
      BROWSER_STANDALONE_SERVER_PATH: standaloneServerPath,
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
    },
    reuseExistingServer: false,
    stderr: "pipe",
    stdout: "pipe",
    timeout: 30_000,
    url: `${baseURL}/health`,
  },
  workers: 1,
});
