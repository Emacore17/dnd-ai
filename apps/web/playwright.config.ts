import { defineConfig } from "@playwright/test";

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;
const webServerCommand = process.env.CI
  ? "node e2e/start-production-server.mjs"
  : `corepack pnpm@10.34.5 exec next dev --hostname 127.0.0.1 --port ${port}`;

const viewportProjects = [
  { name: "mobile-320", viewport: { height: 568, width: 320 }, touch: true },
  { name: "mobile-360", viewport: { height: 800, width: 360 }, touch: true },
  { name: "mobile-390", viewport: { height: 844, width: 390 }, touch: true },
  { name: "tablet-768", viewport: { height: 1024, width: 768 }, touch: true },
  {
    name: "desktop-1024",
    viewport: { height: 768, width: 1024 },
    touch: false,
  },
  {
    name: "desktop-1440",
    viewport: { height: 900, width: 1440 },
    touch: false,
  },
  {
    name: "landscape-568",
    viewport: { height: 320, width: 568 },
    touch: true,
  },
  {
    name: "landscape-844",
    viewport: { height: 390, width: 844 },
    touch: true,
  },
] as const;

export default defineConfig({
  expect: {
    timeout: 7_500,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.005,
    },
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  outputDir: "test-results/playwright/artifacts",
  projects: viewportProjects.map(({ name, touch, viewport }) => ({
    name,
    use: {
      hasTouch: touch,
      isMobile: touch && viewport.width < 768,
      viewport,
    },
  })),
  reporter: [
    ["line"],
    ["json", { outputFile: "test-results/playwright/results.json" }],
  ],
  retries: process.env.CI ? 1 : 0,
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{arg}-{projectName}-{platform}{ext}",
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL,
    colorScheme: "dark",
    locale: "it-IT",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  webServer: {
    command: webServerCommand,
    env: {
      ...process.env,
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: baseURL,
  },
  // One worker gives interaction traces an uncontended browser process on CI.
  workers: 1,
});
