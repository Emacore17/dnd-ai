import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
async function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await read(relativePath));
}

test("BL-079 configures shadcn new-york on the Radix base", async () => {
  const config = await readJson("apps/web/components.json");

  assert.equal(config.style, "new-york");
  assert.equal(config.iconLibrary, "lucide");
  assert.equal(config.rsc, true);
  assert.equal(config.tsx, true);
  assert.equal(config.tailwind.css, "src/app/globals.css");
  assert.equal(config.aliases.components, "@/components");
  assert.equal(config.aliases.ui, "@/components/ui");
});

test("BL-079 keeps the UI stack selective and excludes parallel chat transport and Rive", async () => {
  const manifest = await readJson("apps/web/package.json");
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
  };

  for (const requiredDependency of [
    "geist",
    "lucide-react",
    "motion",
    "radix-ui",
    "tailwindcss",
  ]) {
    assert.ok(
      requiredDependency in dependencies,
      `missing UI dependency: ${requiredDependency}`,
    );
  }

  for (const forbiddenDependency of [
    "@rive-app/canvas",
    "@rive-app/react-canvas",
    "@rive-app/webgl2",
  ]) {
    assert.equal(
      forbiddenDependency in dependencies,
      false,
      `Rive must stay out of the base shell: ${forbiddenDependency}`,
    );
  }

  const sourceFiles = [
    "apps/web/src/app/page.tsx",
    "apps/web/src/components/game/game-shell.tsx",
    "apps/web/src/components/game/free-action-composer.tsx",
  ];
  const source = (
    await Promise.all(sourceFiles.map((filePath) => read(filePath)))
  ).join("\n");

  assert.doesNotMatch(source, /\buseChat\s*\(/u);
  assert.doesNotMatch(source, /DefaultChatTransport|WebSocketChatTransport/u);
});

test("BL-079 exposes semantic tokens, safe-area primitives and no transition-all", async () => {
  const css = await read("apps/web/src/app/globals.css");

  for (const token of [
    "--background:",
    "--foreground:",
    "--primary:",
    "--game-surface:",
    "--game-surface-elevated:",
    "--touch-target:",
    "--touch-target-primary:",
    "--composer-safe-area:",
  ]) {
    assert.ok(css.includes(token), `missing semantic token: ${token}`);
  }

  assert.match(css, /env\(safe-area-inset-bottom/u);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/u);
  assert.doesNotMatch(css, /transition:\s*all\b/u);
});

test("BL-079 provides the selected AI Elements and every game-domain wrapper", async () => {
  const requiredFiles = [
    "apps/web/src/components/ai-elements/conversation.tsx",
    "apps/web/src/components/ai-elements/message.tsx",
    "apps/web/src/components/ai-elements/prompt-input.tsx",
    "apps/web/src/components/ui/alert-dialog.tsx",
    "apps/web/src/components/game/game-conversation.tsx",
    "apps/web/src/components/game/narrative-turn.tsx",
    "apps/web/src/components/game/free-action-composer.tsx",
    "apps/web/src/components/game/game-drawer.tsx",
    "apps/web/src/components/game/rule-result-card.tsx",
    "apps/web/src/components/game/suggested-action-list.tsx",
    "apps/web/src/components/game/choice-set.tsx",
    "apps/web/src/components/game/party-status-panel.tsx",
    "apps/web/src/components/game/current-objective-card.tsx",
    "apps/web/src/components/game/connection-status.tsx",
    "apps/web/src/components/game/turn-progress.tsx",
    "apps/web/src/components/game/safe-retry-banner.tsx",
    "apps/web/src/components/game/save-indicator.tsx",
    "apps/web/src/components/game/game-shell.tsx",
    "apps/web/src/components/motion/game-motion-features.ts",
    "apps/web/src/components/motion/game-motion.tsx",
  ];

  await Promise.all(
    requiredFiles.map(async (filePath) => {
      const source = await read(filePath);
      assert.ok(source.length > 0, `${filePath} must not be empty`);
    }),
  );
});

test("BL-079 models every canonical turn state and documents fixture aliases", async () => {
  const stateContract = await read("apps/web/src/lib/game-shell-state.ts");

  for (const state of [
    "idle",
    "submitting",
    "queued",
    "processing_rules",
    "streaming_provisional",
    "committing",
    "completed",
    "failed_precommit",
    "completed_with_delivery_error",
    "blocked_safety",
  ]) {
    assert.match(stateContract, new RegExp(`\\b${state}\\b`, "u"));
  }

  for (const fixtureAlias of ["loading", "long", "error", "reconnect"]) {
    assert.match(stateContract, new RegExp(`\\b${fixtureAlias}\\b`, "u"));
  }
});

test("BL-079 lazy-loads Motion features and keeps animation non-authoritative", async () => {
  const [motionSource, featureSource] = await Promise.all([
    read("apps/web/src/components/motion/game-motion.tsx"),
    read("apps/web/src/components/motion/game-motion-features.ts"),
  ]);

  assert.match(motionSource, /LazyMotion/u);
  assert.match(
    motionSource,
    /import\("@\/components\/motion\/game-motion-features"\)/u,
  );
  assert.match(featureSource, /domAnimation/u);
  assert.match(motionSource, /useReducedMotion/u);
  assert.match(motionSource, /useSyncExternalStore/u);
  assert.doesNotMatch(motionSource, /setTimeout\s*\(/u);
});

test("BL-079 restricts AI narration to the safe Markdown subset", async () => {
  const messageSource = await read(
    "apps/web/src/components/ai-elements/message.tsx",
  );

  for (const element of ["p", "em", "strong", "ul", "ol", "li"]) {
    assert.match(messageSource, new RegExp(`"${element}"`, "u"));
  }

  assert.match(messageSource, /allowedElements=/u);
  assert.match(messageSource, /skipHtml/u);
  assert.match(messageSource, /unwrapDisallowed/u);
});

test("BL-079 models safety-critical game UI with explicit view contracts", async () => {
  const [choiceSource, retrySource, stateContract] = await Promise.all([
    read("apps/web/src/components/game/choice-set.tsx"),
    read("apps/web/src/components/game/safe-retry-banner.tsx"),
    read("apps/web/src/lib/game-shell-state.ts"),
  ]);

  assert.match(choiceSource, /AlertDialog/u);
  assert.match(choiceSource, /choiceSetId/u);
  assert.match(choiceSource, /prerequisite/u);
  assert.match(choiceSource, /consumed/u);
  assert.match(retrySource, /stateApplied/u);
  assert.match(retrySource, /retryable/u);
  assert.match(stateContract, /RuleDifficultyFixture/u);
  assert.match(stateContract, /sourceLabel/u);
  assert.match(stateContract, /resources/u);
});

test("BL-079 measures a dedicated production performance budget", async () => {
  const [
    playwrightConfig,
    productionServer,
    performanceSpec,
    performanceBudgetSource,
    rootManifest,
    webManifest,
    workflow,
  ] = await Promise.all([
    read("apps/web/playwright.config.ts"),
    read("apps/web/e2e/start-production-server.mjs"),
    read("apps/web/e2e/game-shell.performance.spec.ts"),
    read("apps/web/e2e/performance-budget.mjs"),
    readJson("package.json"),
    readJson("apps/web/package.json"),
    read(".github/workflows/ci.yml"),
  ]);

  assert.match(playwrightConfig, /workers:\s*1[,\n]/u);
  assert.match(
    playwrightConfig,
    /process\.env\.CI[\s\S]*?start-production-server\.mjs/u,
  );
  assert.match(productionServer, /\.next[\s\S]*?standalone/u);
  assert.match(productionServer, /await cp\(sourceStaticDirectory/u);
  assert.match(productionServer, /process\.env\.HOSTNAME/u);
  assert.match(productionServer, /process\.env\.PORT/u);
  assert.equal(
    webManifest.scripts["test:e2e:functional"],
    "playwright test --config playwright.config.ts game-shell.spec.ts",
  );
  assert.equal(
    webManifest.scripts["test:e2e:performance"],
    "playwright test --config playwright.config.ts game-shell.performance.spec.ts --project=mobile-390 --repeat-each=3 --retries=0",
  );
  assert.match(rootManifest.scripts["test:e2e:functional"], /@dnd-ai\/web/u);
  assert.match(rootManifest.scripts["test:e2e:performance"], /@dnd-ai\/web/u);
  assert.match(workflow, /pnpm --filter @dnd-ai\/web build/u);
  assert.match(workflow, /pnpm test:e2e:functional/u);
  assert.match(workflow, /pnpm test:e2e:performance/u);

  for (const contract of [
    /takeRecords\(\)/u,
    /disconnect\(\)/u,
    /long-animation-frame/u,
    /durationThreshold:\s*16/u,
    /testInfo\.attach/u,
    /waitForScrollToSettle/u,
    /state\.inputs\.push/u,
  ]) {
    assert.match(performanceSpec, contract);
  }

  for (const budget of [
    /maximumInteractionDurationMs:\s*104/u,
    /maximumEventProcessingTimeMs:\s*50/u,
    /maximumBlockingDurationMs:\s*0/u,
    /maximumCumulativeLayoutShift:\s*0\.1/u,
    /input-missing/u,
  ]) {
    assert.match(performanceBudgetSource, budget);
  }

  assert.doesNotMatch(
    performanceSpec,
    /observe\(\{\s*buffered:\s*true,\s*type:\s*"longtask"\s*\}\)/u,
  );
});
