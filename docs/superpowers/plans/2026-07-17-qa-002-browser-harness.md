---
status: active
owner: engineering-and-qa
last_reviewed: 2026-07-17
last_verified_commit: f653e63d4dc5bf7627c37622deaca64850961602
source_refs:
  - docs/TASKS.md#qa-002--browser-accessibility-e-visual-regression-harness
  - docs/superpowers/specs/2026-07-17-qa-002-browser-harness-design.md
related_tasks:
  - QA-001
  - QA-002
  - BL-081
code_refs:
  - package.json
  - scripts/run-tests.mjs
  - scripts/lib/test-lane-policy.mjs
  - scripts/lib/test-report-policy.mjs
  - .github/workflows/ci.yml
test_refs:
  - tests/unit/test-lane-policy.test.mjs
  - tests/unit/test-report-policy.test.mjs
  - tests/contracts/ci-workflow.test.mjs
supersedes: null
---

# QA-002 Browser Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task in the current inline session. Do not delegate batches or create parallel worktrees.

**Goal:** Aggiungere una corsia Playwright deterministica che verifichi shell mobile, accessibility, reduced-motion e regressione visuale senza dipendere da Vercel.

**Architecture:** `TEST_LANES` registra `e2e` con executor Playwright; il runner esistente seleziona una porta loopback, costruisce il web standalone, esegue Chromium e normalizza il JUnit nello schema `testing-foundation-v1`. Config, fixture axe, spec di feature e auto-test dei failure path vivono sotto `tests/e2e`, mentre la CI installa soltanto Chromium e conserva il check protetto esistente.

**Tech Stack:** Node `24.11.0`, pnpm `11.13.0`, Playwright Test `1.61.1`, Chromium pinato Playwright, axe-core Playwright `4.12.1`, Next.js `16.2.10`, React `19.2.7`, Node test runner.

## Global Constraints

- Corsia `HIGH_RISK`: lockfile, runner, workflow CI e artifact cambiano.
- Esecuzione inline nella worktree isolata esistente sulla branch `codex/qa-002-browser-harness`.
- Base `f653e63d4dc5bf7627c37622deaca64850961602`; baseline web build verde e shell mirata 22/22.
- Un solo executor browser, Chromium; retry `0`, worker `1`, rete esterna vietata.
- Il server usa soltanto Next standalone su `127.0.0.1` e porta effimera; `reuseExistingServer=false`.
- Il comando normale non crea o aggiorna snapshot; update vietato in CI.
- Viewport obbligatorie: `320×800`, `390×844`, `1440×900`; almeno il profilo 390 ha `hasTouch=true`.
- Target touch minimo `44×44` CSS px; CTA primaria frequente `48 px`.
- Accessibility automatica più tastiera/focus/zoom/reduced-motion; axe da solo non soddisfa il criterio.
- Baseline PNG separate per `{platform}` e generate nella stessa versione Playwright usata dal test.
- Artifact ammesso: JUnit normalizzato/manifest QA; niente trace, video, raw axe, log o screenshot runtime caricati.
- Nessun cambio di prodotto, provider, deploy, staging o azione Vercel.
- TDD per ogni batch; un solo full `TURBO_FORCE=true corepack pnpm@11.13.0 verify` sul candidato finale.

---

### Task 1: Registrare dipendenze e contratto della lane browser

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `scripts/lib/test-lane-policy.mjs`
- Modify: `tests/unit/test-lane-policy.test.mjs`
- Create: `tests/contracts/browser-harness-contract.test.mjs`

**Interfaces:**
- Produces: `TEST_LANES.e2e` con `executor: "playwright"`, owner `QA-002`, pattern `tests/e2e/*.spec.mjs`.
- Produces: script pubblici `test:e2e`, `test:e2e:update`, `test:e2e:install`, `test:e2e:install:ci`.

- [ ] **Step 1: scrivere i test RED del catalogo**

```js
assert.deepEqual(TEST_LANES.e2e, {
  buildFilters: ["@dnd-ai/web"],
  concurrency: 1,
  executor: "playwright",
  name: "e2e",
  ownerTaskIds: ["QA-002"],
  patterns: ["tests/e2e/*.spec.mjs"],
  timeoutMs: 300_000,
});
```

Il contract deve inoltre richiedere versioni esatte di `@playwright/test` e `@axe-core/playwright`, vietarle nei package applicativi e controllare che non esistano browser cloud o plugin duplicati.

- [ ] **Step 2: osservare il RED**

Run: `node --test tests/unit/test-lane-policy.test.mjs tests/contracts/browser-harness-contract.test.mjs`

Expected: FAIL perché `e2e` e le due dipendenze non esistono.

- [ ] **Step 3: installare i due dev dependency root e aggiungere la lane**

Run: `corepack pnpm@11.13.0 add -Dw -E @playwright/test@1.61.1 @axe-core/playwright@4.12.1`

Aggiornare `package.json` con:

```json
"test:e2e": "node scripts/run-tests.mjs e2e",
"test:e2e:update": "node scripts/update-browser-snapshots.mjs",
"test:e2e:install": "playwright install chromium",
"test:e2e:install:ci": "playwright install --with-deps chromium"
```

In `TEST_LANES`, aggiungere `executor: "node"` alle lane esistenti e la configurazione `e2e` testata.

- [ ] **Step 4: rendere la discovery extension-aware**

Per `executor === "node"` accettare soltanto `.test.mjs`; per `playwright` soltanto `.spec.mjs`. Conservare realpath, regular-file e repository confinement.

- [ ] **Step 5: verificare GREEN e audit**

Run: `node --test tests/unit/test-lane-policy.test.mjs tests/contracts/browser-harness-contract.test.mjs`

Expected: PASS.

Run: `corepack pnpm@11.13.0 audit --audit-level=high`

Expected: exit `0`.

- [ ] **Step 6: commit**

```powershell
git add package.json pnpm-lock.yaml scripts/lib/test-lane-policy.mjs tests/unit/test-lane-policy.test.mjs tests/contracts/browser-harness-contract.test.mjs
git commit -m "test: register the browser test lane"
```

### Task 2: Eseguire Playwright dal runner comune e normalizzare i report

**Files:**
- Modify: `scripts/run-tests.mjs`
- Create: `scripts/update-browser-snapshots.mjs`
- Modify: `scripts/lib/test-process.mjs`
- Modify: `scripts/lib/test-report-policy.mjs`
- Modify: `tests/integration/test-runner.test.mjs`
- Modify: `tests/unit/test-report-policy.test.mjs`
- Create: `tests/fixtures/testing/browser-passing.spec.mjs`

**Interfaces:**
- Produces: `reserveLoopbackPort(): Promise<number>` confinata al runner browser.
- Produces: ambiente Playwright esplicito con `HOSTNAME`, `PORT`, `PLAYWRIGHT_JUNIT_OUTPUT_FILE`.
- Produces: update snapshot esplicito che riusa lo stesso executor e rifiuta `CI`.
- Consumes: `TEST_LANES.e2e` del Task 1.

- [ ] **Step 1: aggiungere self-test RED del runner**

Il test deve invocare una funzione/spawn iniettato e verificare:

```js
assert.equal(invocation.command, packageManagerCommand);
assert.deepEqual(invocation.arguments_.slice(-5), [
  "exec",
  "playwright",
  "test",
  "--config=tests/e2e/playwright.config.mjs",
  "--update-snapshots=none",
]);
assert.equal(invocation.environment.HOSTNAME, "127.0.0.1");
assert.match(invocation.environment.PORT, /^\d+$/u);
assert.equal("DATABASE_URL" in invocation.environment, false);
```

Il report e2e normalizzato deve produrre manifest task IDs `QA-002` e nessun coverage file.

- [ ] **Step 2: osservare il RED**

Run: `node --test tests/integration/test-runner.test.mjs tests/unit/test-report-policy.test.mjs`

Expected: FAIL perché il runner prova a usare `node --test` sulla lane e2e.

- [ ] **Step 3: implementare l'executor Playwright minimo**

Nel runner:

```js
if (lane.executor === "playwright") {
  return runPlaywrightLane({
    environment,
    lane,
    reportWorkspace,
    repositoryRoot,
    updateSnapshots: false,
  });
}
```

`runPlaywrightLane` deve riservare la porta, invocare Playwright senza shell e scrivere il JUnit raw nel workspace esistente. `finalizeReports()` continua a normalizzare JUnit; LCOV resta esclusivo della lane `unit`. Esportare un entry point riusabile dal wrapper snapshot:

```js
export async function runSelectedLanes({ environment, laneNames, updateSnapshots = false }) {
  if (updateSnapshots && (environment.CI === "true" || laneNames.length !== 1 || laneNames[0] !== "e2e")) {
    throw new Error("test-runner: snapshot-update-forbidden");
  }
  // esegue le lane in ordine e restituisce il primo exit non-zero
}
```

`scripts/update-browser-snapshots.mjs` invoca soltanto `runSelectedLanes({ laneNames: ["e2e"], updateSnapshots: true })`; non accetta argomenti o override di path/config.

- [ ] **Step 4: provare exit/report failure**

Il self-test deve coprire exit non-zero, JUnit mancante e porta non numerica con errori statici `test-runner:*`, senza includere stdout/stderr o environment.

- [ ] **Step 5: verificare GREEN**

Run: `node --test tests/integration/test-runner.test.mjs tests/unit/test-report-policy.test.mjs`

Expected: PASS.

- [ ] **Step 6: commit**

```powershell
git add scripts/run-tests.mjs scripts/update-browser-snapshots.mjs scripts/lib/test-process.mjs scripts/lib/test-report-policy.mjs tests/integration/test-runner.test.mjs tests/unit/test-report-policy.test.mjs tests/fixtures/testing/browser-passing.spec.mjs
git commit -m "test: execute Playwright through the common runner"
```

### Task 3: Configurare server locale e matrice reale della shell

**Files:**
- Create: `tests/e2e/playwright.config.mjs`
- Create: `tests/e2e/browser-fixture.mjs`
- Create: `tests/e2e/game-shell.spec.mjs`
- Modify: `tests/contracts/browser-harness-contract.test.mjs`

**Interfaces:**
- Produces: fixture `test`/`expect` che fallisce su console error e attende font/shell readiness.
- Produces: helper `openGameShell(page, viewport)` e `assertReachableViewport(page)`.

- [ ] **Step 1: installare Chromium locale**

Run: `corepack pnpm@11.13.0 test:e2e:install`

Expected: Chromium Playwright `1.61.1` disponibile; nessun altro browser installato dal comando.

- [ ] **Step 2: scrivere config e spec RED**

La config deve usare:

```js
export default defineConfig({
  testDir: ".",
  testMatch: ["*.spec.mjs"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  updateSnapshots: "none",
  use: { baseURL, browserName: "chromium", colorScheme: "dark", trace: "off", video: "off" },
  webServer: { command: "node apps/web/.next/standalone/apps/web/server.js", cwd: repositoryRoot, url: `${baseURL}/health`, reuseExistingServer: false },
});
```

La spec deve creare test distinti `QA-002:small-mobile-layout`, `QA-002:phone-touch-layout`, `QA-002:desktop-layout` e verificare root, composer, HUD, overflow e target.

- [ ] **Step 3: osservare il RED browser**

Run: `corepack pnpm@11.13.0 test:e2e`

Expected: FAIL sul primo requisito ancora non soddisfatto o su config/report non completo; non accettare test non scoperti.

- [ ] **Step 4: completare helper e interazioni minime**

Usare locators per ruolo/label, non selector CSS fragili, e verificare invio libero, scelta suggerita, drawer e focus restore. Il profilo touch deve creare un context con `hasTouch: true` e usare `page.touchscreen.tap()` su un target reale.

- [ ] **Step 5: verificare GREEN**

Run: `corepack pnpm@11.13.0 test:e2e`

Expected: tutti i test layout/interazione PASS e JUnit e2e normalizzato presente.

- [ ] **Step 6: commit**

```powershell
git add tests/e2e tests/contracts/browser-harness-contract.test.mjs
git commit -m "test: cover the responsive game shell in Chromium"
```

### Task 4: Accessibility, tastiera, zoom, safe-area e reduced-motion

**Files:**
- Modify: `tests/e2e/browser-fixture.mjs`
- Modify: `tests/e2e/game-shell.spec.mjs`
- Create: `tests/e2e/accessibility.spec.mjs`

**Interfaces:**
- Produces: `analyzeAccessibility(page)` e `assertNoAccessibilityBlockers(result)`.

- [ ] **Step 1: scrivere casi RED**

```js
test("QA-002:axe-blocks-an-intentional-violation", async ({ page }) => {
  await page.setContent("<main><button></button></main>");
  const result = await analyzeAccessibility(page);
  expect(result.violations.some(({ id }) => id === "button-name")).toBe(true);
  expect(() => assertNoAccessibilityBlockers(result)).toThrow(/button-name/u);
});
```

Aggiungere test per Tab/focus, Escape+restore, `zoom: 2`, `--safe-area-bottom: 34px` e media query reduced.

- [ ] **Step 2: osservare il RED**

Run: `corepack pnpm@11.13.0 test:e2e`

Expected: FAIL perché helper axe e assertion non esistono.

- [ ] **Step 3: implementare fixture axe e assertion stabile**

Usare `AxeBuilder.withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])`; serializzare negli errori soltanto ID/impact/target bounded, mai HTML completo.

- [ ] **Step 4: completare i path manuali automatizzati**

Con locators e computed style provare CTA visibile/raggiungibile dopo zoom e safe-area; con `reducedMotion: "reduce"` provare contenuto e controlli immediatamente disponibili e nessuna informazione esclusiva dell'animazione.

- [ ] **Step 5: verificare GREEN**

Run: `corepack pnpm@11.13.0 test:e2e`

Expected: shell senza blocker axe e negative fixture correttamente bloccante.

- [ ] **Step 6: commit**

```powershell
git add tests/e2e/browser-fixture.mjs tests/e2e/game-shell.spec.mjs tests/e2e/accessibility.spec.mjs
git commit -m "test: enforce accessible mobile game interactions"
```

### Task 5: Baseline visuali e auto-test dei failure path

**Files:**
- Modify: `tests/e2e/playwright.config.mjs`
- Modify: `tests/e2e/game-shell.spec.mjs`
- Create: `tests/e2e/harness-failures.spec.mjs`
- Create: `tests/e2e/__screenshots__/win32/**`
- Create: `tests/e2e/__screenshots__/linux/**`
- Create: `tests/fixtures/browser/**`

**Interfaces:**
- Produces: snapshot path `{testDir}/__screenshots__/{platform}/{testFileBaseName}/{arg}{ext}`.
- Produces: tre fixture subprocess che devono terminare non-zero.

- [ ] **Step 1: aggiungere aspettative screenshot RED**

Per 320, 390 e 1440 usare:

```js
await expect(page).toHaveScreenshot(`game-shell-${width}.png`, {
  animations: "disabled",
  caret: "hide",
  maxDiffPixels: 0,
});
```

Run: `corepack pnpm@11.13.0 test:e2e`

Expected: FAIL `snapshot missing`; il comando normale non deve creare una baseline accettata automaticamente.

- [ ] **Step 2: generare baseline Windows in modo esplicito**

Usare l'entry point update locale del runner con guard `CI !== true`, poi rieseguire due volte il comando normale e confrontare SHA-256 dei PNG tra le run.

- [ ] **Step 3: generare baseline Linux con container Playwright pinato**

Usare `mcr.microsoft.com/playwright:v1.61.1-noble`, frozen install e update esplicito dentro un checkout/mount pulito. Copiare soltanto i PNG Linux versionati; rimuovere container/volume temporanei.

- [ ] **Step 4: creare fixture server/crash/drift e auto-test**

`harness-failures.spec.mjs` deve invocare Playwright su ciascuna config fixture con timeout/output bounded e asserire `code !== 0`. La fixture drift usa un non-image snapshot atteso `expected` contro valore `actual`; la regressione visuale reale resta nei PNG della shell.

- [ ] **Step 5: verificare due run GREEN**

Run due volte: `corepack pnpm@11.13.0 test:e2e`

Expected: PASS identico; nessun PNG tracked cambia, le tre fixture negative sono osservate rosse dal test esterno verde.

- [ ] **Step 6: commit**

```powershell
git add tests/e2e tests/fixtures/browser
git commit -m "test: add deterministic visual and failure baselines"
```

### Task 6: Integrare CI, artifact e documentazione living

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `tests/contracts/ci-workflow.test.mjs`
- Modify: `tests/security/test-report-security.test.mjs`
- Modify: `package.json`
- Modify: `docs/testing/TEST_STRATEGY.md`
- Modify: `docs/product/UX_UI_DESIGN.md`
- Modify: `docs/CONTEXT.md`
- Modify: `docs/TRACEABILITY.md`
- Modify: `docs/TASKS.md`

**Interfaces:**
- Produces: CI `Install Chromium` e `Browser tests` nel job `Tests`.
- Produces: artifact required lanes `unit,integration,database,contract,e2e`.

- [ ] **Step 1: scrivere contract/security RED**

Richiedere nel workflow, nell'ordine:

```yaml
- name: Install Chromium
  run: pnpm test:e2e:install:ci
- name: Browser tests
  run: pnpm test:e2e
```

I comandi prepare/verify devono includere `e2e`; il security test deve vietare trace, video, raw axe, `.env`, URL remoti e artifact browser fuori allowlist.

- [ ] **Step 2: osservare il RED**

Run: `node --test tests/contracts/ci-workflow.test.mjs tests/security/test-report-security.test.mjs tests/contracts/browser-harness-contract.test.mjs`

Expected: FAIL sul workflow non ancora aggiornato.

- [ ] **Step 3: aggiornare workflow e full command**

Inserire l'installazione una volta dopo setup, la lane dopo contract e `e2e` nei report. `pnpm verify` eredita `e2e` da `run-tests all`; non duplicare il comando.

- [ ] **Step 4: aggiornare living docs**

Registrare `browser-harness-v1`, comandi, baseline, failure policy, rischio chiuso e stato QA-002. BL-080 resta `BLOCKED` e non cambia.

- [ ] **Step 5: verificare mirati e docs**

Run: `node --test tests/contracts/ci-workflow.test.mjs tests/security/test-report-security.test.mjs tests/contracts/browser-harness-contract.test.mjs`

Run: `corepack pnpm@11.13.0 verify:docs`

Expected: tutti PASS.

- [ ] **Step 6: commit**

```powershell
git add .github/workflows/ci.yml package.json tests/contracts tests/security docs
git commit -m "ci: gate changes with the browser harness"
```

### Task 7: Candidato, clean checkout e delivery protetta

**Files:**
- Modify only if evidence changes semantics: `docs/TASKS.md`, `docs/CONTEXT.md`, `docs/TRACEABILITY.md`, `docs/testing/TEST_STRATEGY.md`

- [ ] **Step 1: eseguire le lane mirate finali**

Run: `corepack pnpm@11.13.0 test:e2e`

Run: `node --test tests/unit/test-lane-policy.test.mjs tests/unit/test-report-policy.test.mjs tests/integration/test-runner.test.mjs tests/contracts/browser-harness-contract.test.mjs tests/contracts/ci-workflow.test.mjs tests/security/test-report-security.test.mjs`

Expected: PASS.

- [ ] **Step 2: eseguire l'unico full gate**

Run: `TURBO_FORCE=true corepack pnpm@11.13.0 verify`

Expected: exit `0`, incluse lane `e2e`, report/artifact e guardrail root.

- [ ] **Step 3: self-review P0/P1**

Rileggere diff, package/lockfile, workflow, config, report policy, snapshot e test. Correggere soltanto finding reali; P2 non bloccanti diventano backlog.

- [ ] **Step 4: clean checkout cross-platform**

Da worktree detached pulita: frozen install, install Chromium, browser contract, `test:e2e`, report prepare/verify con e2e, build web, docs e secret scan. Su Linux usare la baseline Linux; su Windows quella win32.

- [ ] **Step 5: chiudere il candidato nello stesso change set**

Impostare QA-002 `DONE/100%/PASSING` branch-local, registrare comandi/exit/environment e rendere READY il successivo P0 realmente sbloccato. Nessun commit di sola evidenza dopo CI.

- [ ] **Step 6: PR e main**

Push della branch, una sola PR, attendere `CI / Merge gate`, integrare senza bypass e verificare la run post-merge sul merge commit. Non eseguire azioni Vercel.
