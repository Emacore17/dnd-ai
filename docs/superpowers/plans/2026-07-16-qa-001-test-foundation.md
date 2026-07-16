---
status: active
owner: engineering-and-qa
last_reviewed: 2026-07-16
last_verified_commit: 0ad73aaabc00a3c70cc94bcb06d01c0bc018575c
source_refs:
  - docs/superpowers/specs/2026-07-16-qa-001-test-foundation-design.md
  - docs/MVP_SPEC.md#26-strategia-di-testing
  - docs/MVP_SPEC.md#351-definition-of-done-per-user-story
  - docs/TASKS.md#qa-001--fondazione-comune-per-test-fixture-e-comandi-di-qualità
related_tasks:
  - QA-001
  - QA-002
  - BL-004
  - BL-079
  - GOV-002
code_refs:
  - packages/testing
  - scripts/lib/postgres-test-container.mjs
  - .github/workflows/ci.yml
test_refs:
  - tests/database/database-migrations.test.mjs
  - tests/contracts/ci-workflow.test.mjs
  - tests/integration/ci-gate.test.mjs
supersedes: null
---

# QA-001 Test Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementare `testing-foundation-v1` con primitive deterministiche, runner Node isolato, lifecycle PostgreSQL/Redis e report JUnit/LCOV verificabili.

**Architecture:** `@dnd-ai/testing` mantiene un root platform-neutral e un export `./node` per il lifecycle Docker CLI. Il runner root scopre file reali, esegue build prerequisite e processi `node:test` senza shell, normalizza i reporter nativi Node e prepara un artifact allowlisted. Le superfici pubbliche esistenti restano stabili e vengono collegate al runner.

**Tech Stack:** TypeScript strict 6.0.3, Node `24.11.0` `node:test`/reporter nativi, pnpm `11.13.0`, Turborepo `2.10.4`, Docker CLI `29.2.1`, PostgreSQL 17 + pgvector `0.8.2`, Redis `7.4.7-alpine3.21`.

## Global Constraints

- Corsia `HIGH_RISK`: cambiano workflow, artifact e lifecycle container; test mirati, un full `verify`, checkout pulito e CI protetta sono obbligatori.
- Mantenere Node `24.11.0`; non introdurre Vitest, Testcontainers, un secondo runner o install impliciti.
- Il root `@dnd-ai/testing` non importa moduli Node; il subpath `@dnd-ai/testing/node` non entra nei bundle applicativi o browser.
- Ogni processo test usa isolamento `process`, timeout bounded e zero retry automatici.
- I processi figli ricevono soltanto environment allowlisted; nessun secret, URL applicativo o payload entra in report o manifest.
- PostgreSQL conserva il pin esistente; Redis usa `redis:7.4.7-alpine3.21@sha256:02f2cc4882f8bf87c79a220ac958f58c700bdec0dfb9b9ea61b62fb0e8f1bfcf`.
- Output generati confinati in `test-results/testing-foundation-v1` e artifact in `artifacts/testing`; entrambi restano ignorati da Git.
- Coverage iniziale `80%` lines/functions/branches limitata a `packages/testing/dist/**/*.js`.
- Nessuna UI, Playwright, accessibility, visual regression, eval AI, provider, account, deploy o azione Vercel.

---

### Task 1: Primitive deterministiche e contratto package

**Files:**
- Create: `packages/testing/src/test-id.ts`
- Create: `packages/testing/src/seeded-rng.ts`
- Create: `packages/testing/src/fake-clock.ts`
- Create: `packages/testing/src/fixture-factory.ts`
- Modify: `packages/testing/src/index.ts`
- Modify: `packages/testing/package.json`
- Create: `tests/unit/testing-primitives.test.mjs`
- Create: `tests/contracts/testing-package-contract.test.mjs`

**Interfaces:**
- Produces: `createTestId(taskId, caseSlug): TestId`.
- Produces: `createSeededRng(seed): SeededRng` con `next()`, `integer({ min, max })` e `snapshot()`.
- Produces: `createFakeClock(initial): FakeClock` con `now()`, `nowMs()`, `advanceBy(milliseconds)` e `set(instant)` monotono.
- Produces: `createFixtureFactory({ base, parse }): FixtureFactory<T>`; ogni risultato è detached e validato.

- [x] **Step 1: scrivere i test RED delle primitive**

  Coprire nel test unitario sequenza golden e snapshot RNG, range inclusivo, seed/range invalidi, clock monotono, fixture detached/override/parse failure e formato test ID:

  ```js
  const id = createTestId("QA-001", "seeded-rng-golden-sequence");
  assert.equal(id, "QA-001:seeded-rng-golden-sequence");

  const first = createSeededRng(0x12345678);
  const second = createSeededRng(0x12345678);
  assert.deepEqual(
    Array.from({ length: 5 }, () => first.next()),
    Array.from({ length: 5 }, () => second.next()),
  );

  const clock = createFakeClock("2026-07-16T00:00:00.000Z");
  clock.advanceBy(1_000);
  assert.equal(clock.now().toISOString(), "2026-07-16T00:00:01.000Z");
  assert.throws(() => clock.set("2026-07-15T23:59:59.000Z"), /non-monotonic/);
  ```

- [x] **Step 2: eseguire il test RED**

  Run: `corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/testing && node --test tests/unit/testing-primitives.test.mjs tests/contracts/testing-package-contract.test.mjs`

  Expected: `FAIL` perché gli export platform-neutral non esistono.

- [x] **Step 3: implementare il minimo contratto platform-neutral**

  Usare firme TypeScript esplicite e nessuno stato globale:

  ```ts
  export type TestId = string & { readonly __brand: "TestId" };

  export interface SeededRng {
    next(): number;
    integer(range: Readonly<{ min: number; max: number }>): number;
    snapshot(): Readonly<{ algorithm: "xorshift32-v1"; state: number }>;
  }

  export interface FakeClock {
    now(): Date;
    nowMs(): number;
    advanceBy(milliseconds: number): void;
    set(instant: string | Date): void;
  }

  export interface FixtureFactoryOptions<T extends object> {
    base: () => T;
    parse: (candidate: unknown) => T;
  }

  export type FixtureFactory<T extends object> = (
    overrides?: Readonly<Partial<T>>,
  ) => T;
  ```

  `createSeededRng` usa `xorshift32-v1` con operazioni unsigned; `createFixtureFactory` applica `structuredClone` prima e dopo `parse`; `createTestId` accetta task ID maiuscoli segmentati e slug kebab-case non vuoti.

- [x] **Step 4: verificare GREEN e boundary browser-safe**

  Run: `corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/testing && node --test tests/unit/testing-primitives.test.mjs tests/contracts/testing-package-contract.test.mjs`

  Expected: `PASS`; il contract test conferma che `dist/index.js` non contiene import `node:` e che gli export sono frozen o restituiscono copie detached.

- [x] **Step 5: commit funzionale**

  ```bash
  git add packages/testing pnpm-lock.yaml tests/unit/testing-primitives.test.mjs tests/contracts/testing-package-contract.test.mjs
  git commit -m "feat(testing): add deterministic test primitives"
  ```

### Task 2: Lifecycle Docker Node-only per PostgreSQL e Redis

**Files:**
- Create: `packages/testing/src/node/index.ts`
- Create: `packages/testing/src/node/docker-container.ts`
- Create: `packages/testing/src/node/postgres-container.ts`
- Create: `packages/testing/src/node/redis-container.ts`
- Modify: `packages/testing/package.json`
- Modify: `scripts/lib/postgres-test-container.mjs`
- Modify: `package.json`
- Create: `tests/unit/test-container-lifecycle.test.mjs`
- Create: `tests/integration/testing-containers.test.mjs`
- Modify: `tests/contracts/testing-package-contract.test.mjs`

**Interfaces:**
- Produces: `DockerCommandRunner`, `DockerContainerSpec`, `DockerTestContainer` e `createDockerContainerLifecycle(dependencies)` per testare startup/cleanup senza Docker reale.
- Produces: `startPostgresTestContainer`, `stopPostgresTestContainer`, `withPostgresTestContainer` con contratto retrocompatibile.
- Produces: `startRedisTestContainer`, `stopRedisTestContainer`, `withRedisTestContainer`; risultato `{ containerId, host, image, port, redisUrl, stop }` frozen.
- Consumes: `randomUUID`, clock e delay iniettati nel lifecycle; nessun `Math.random`.

- [x] **Step 1: scrivere i test RED del lifecycle**

  Il fake executor deve osservare sequenza esatta `run -> port -> readiness`, cleanup dopo timeout, cleanup failure non mascherata, `rm --force` idempotente su container assente e rifiuto di ID/port/output malformati:

  ```js
  const calls = [];
  const lifecycle = createDockerContainerLifecycle({
    delay: async () => {},
    now: (() => { let value = 0; return () => (value += 250); })(),
    randomId: () => "00000000-0000-4000-8000-000000000001",
    runDocker: async (args) => {
      calls.push(args);
      return fakeDockerResponse(args);
    },
  });

  await assert.rejects(
    lifecycle.start(redisSpec),
    /test-container: readiness-timeout/,
  );
  assert.ok(calls.some((args) => args.join(" ").includes("rm --force")));
  ```

- [x] **Step 2: eseguire il test RED**

  Run: `corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/testing && node --test tests/unit/test-container-lifecycle.test.mjs`

  Expected: `FAIL` sul subpath `@dnd-ai/testing/node` mancante.

- [x] **Step 3: implementare lifecycle generico e adapter concreti**

  Il contratto interno deve essere chiuso e bounded:

  ```ts
  export interface DockerContainerSpec {
    readonly kind: "postgres" | "redis";
    readonly image: string;
    readonly containerPort: number;
    readonly runArguments: readonly string[];
    readonly readinessArguments: readonly string[];
    readonly readinessTimeoutMs: number;
  }

  export interface DockerTestContainer {
    readonly containerId: string;
    readonly host: "127.0.0.1";
    readonly image: string;
    readonly port: number;
    stop(): Promise<void>;
  }
  ```

  Tutti i `docker` usano `execFile` con `windowsHide`, timeout e `maxBuffer` bounded. `docker run` usa `--detach --rm --name`, `127.0.0.1::<port>` e storage effimero; Redis usa `--save "" --appendonly no`. PostgreSQL mantiene database, utente, password locale e immagine già versionati.

- [x] **Step 4: mantenere compatibilità e aggiungere lo smoke reale**

  `scripts/lib/postgres-test-container.mjs` diventa un re-export da `packages/testing/dist/node/index.js`. Il contract test verifica che `@dnd-ai/testing/node` punti a `dist/node/index.js`, mentre il root compilato resta privo di import `node:`. Lo smoke apre due coppie PostgreSQL/Redis concorrenti, prova porte distinte, crea dati differenti e verifica che ogni coppia legga soltanto i propri dati. Per Redis usare un piccolo client RESP su `node:net` nella fixture di test, senza dipendenza runtime.

  Run: `corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/testing --filter=@dnd-ai/persistence && node --test tests/unit/test-container-lifecycle.test.mjs tests/contracts/testing-package-contract.test.mjs && node --test --test-concurrency=1 tests/integration/testing-containers.test.mjs`

  Expected: `PASS`; Docker indisponibile è una failure esplicita, non uno skip silenzioso.

- [x] **Step 5: rieseguire la suite migration retrocompatibile**

  Run: `corepack pnpm@11.13.0 db:migrate:test`

  Expected: `PASS` con lo stesso contratto `start/stop/withPostgresTestContainer`.

- [x] **Step 6: commit funzionale**

  ```bash
  git add packages/testing scripts/lib/postgres-test-container.mjs package.json tests/unit/test-container-lifecycle.test.mjs tests/integration/testing-containers.test.mjs tests/contracts/testing-package-contract.test.mjs
  git commit -m "feat(testing): add isolated database containers"
  ```

### Task 3: Catalogo corsie e runner subprocess isolato

**Files:**
- Create: `scripts/lib/test-lane-policy.mjs`
- Create: `scripts/lib/test-process.mjs`
- Create: `scripts/run-tests.mjs`
- Create: `tests/unit/test-lane-policy.test.mjs`
- Create: `tests/integration/test-runner.test.mjs`
- Create: `tests/fixtures/testing/passing.test.mjs`
- Create: `tests/fixtures/testing/failing.test.mjs`
- Create: `tests/fixtures/testing/environment.test.mjs`
- Create: `tests/fixtures/testing/hanging.test.mjs`

**Interfaces:**
- Produces: `TEST_LANES`, `resolveTestLane(name)`, `discoverLaneFiles(root, lane)` e `createChildEnvironment(source)`; ogni lane dichiara `ownerTaskIds: ["QA-001"]` finché un task proprietario non registra una suite dedicata.
- Produces: `runTestProcess({ files, timeoutMs, environment, reporters })` con risultato `{ code, signal, stdout, stderr }` e kill bounded dell'intero child.
- Produces: CLI `node scripts/run-tests.mjs <unit|integration|database|contract|security|all>`; input e opzioni non allowlisted falliscono prima della build.

- [x] **Step 1: scrivere i contract test RED del catalogo**

  Verificare cinque corsie e `all`, ordine stabile dei file, database concurrency `1`, process isolation, timeout intero positivo, build filter esatti, rifiuto di corsia sconosciuta/vuota e path fuori `tests/`:

  ```js
  assert.deepEqual(Object.keys(TEST_LANES), [
    "unit",
    "integration",
    "database",
    "contract",
    "security",
  ]);
  assert.equal(resolveTestLane("database").concurrency, 1);
  assert.throws(() => resolveTestLane("e2e"), /unknown-lane/);
  ```

- [x] **Step 2: eseguire i test RED**

  Run: `node --test tests/unit/test-lane-policy.test.mjs tests/integration/test-runner.test.mjs`

  Expected: `FAIL` perché policy, runner e fixture non esistono.

- [x] **Step 3: implementare discovery, environment e processo**

  Usare `node:fs/promises.glob` per risolvere file ordinati prima dello spawn. L'environment child conserva soltanto chiavi operative portabili:

  ```js
  export const CHILD_ENV_ALLOWLIST = Object.freeze([
    "CI", "GITHUB_ACTIONS", "HOME", "PATH", "Path", "PATHEXT",
    "RUNNER_OS", "SYSTEMROOT", "TEMP", "TMP", "USERPROFILE", "WINDIR",
  ]);

  export function createChildEnvironment(source) {
    return Object.fromEntries(
      CHILD_ENV_ALLOWLIST.flatMap((key) =>
        typeof source[key] === "string" ? [[key, source[key]]] : [],
      ),
    );
  }
  ```

  Eseguire Turbo tramite `process.execPath node_modules/turbo/bin/turbo`, quindi Node tramite `process.execPath`; non usare `shell: true`. Rimuovere `NODE_TEST_CONTEXT` e non propagare `NODE_OPTIONS`.

- [x] **Step 4: dimostrare process isolation e failure propagation**

  Il test integration invoca direttamente `runTestProcess` su fixture allowlisted e prova exit `0`, exit `1`, timeout statico e assenza di `APP_`, `DATABASE_URL`, `REDIS_URL`, token e password nel child.

  Run: `node --test tests/unit/test-lane-policy.test.mjs tests/integration/test-runner.test.mjs`

  Expected: `PASS`; fixture failing resta fuori dalle glob di ogni corsia reale.

- [x] **Step 5: commit funzionale**

  ```bash
  git add scripts/lib/test-lane-policy.mjs scripts/lib/test-process.mjs scripts/run-tests.mjs tests/unit/test-lane-policy.test.mjs tests/integration/test-runner.test.mjs tests/fixtures/testing
  git commit -m "feat(testing): add isolated Node test runner"
  ```

### Task 4: JUnit, LCOV e artifact deterministico

**Files:**
- Create: `scripts/lib/test-report-policy.mjs`
- Create: `scripts/prepare-test-reports.mjs`
- Create: `scripts/verify-test-reports.mjs`
- Modify: `scripts/run-tests.mjs`
- Create: `tests/unit/test-report-policy.test.mjs`
- Create: `tests/security/test-report-security.test.mjs`
- Create: `tests/fixtures/testing/junit-malformed.xml`
- Create: `tests/fixtures/testing/lcov-malformed.info`

**Interfaces:**
- Produces: `normalizeJUnitReport(source, { lane, knownTaskIds })`, `normalizeLcovReport(source)`, `prepareTestReportArtifact(options)` e `verifyTestReportArtifact(options)`.
- Produces: schema manifest `testing-foundation-v1` con `commit`, `lanes`, `taskIds`, `tests`, `files[{ path, bytes, sha256 }]`.
- Consumes: reporter nativi Node `spec`, `junit`, `lcov`; JUnit/LCOV raw restano temporanei e non entrano nell'artifact.

- [x] **Step 1: scrivere i test RED di normalizzazione e security**

  Usare due JUnit equivalenti con durate e path assoluti differenti e pretendere byte identici dopo normalizzazione. Rifiutare XML malformato, case duplicati, task ID non valido, LCOV fuori repository, symlink/junction, `.env`, URL con credenziali, private key marker e manifest con checksum errato:

  ```js
  const first = normalizeJUnitReport(junitWithRuntime("0.014", "C:\\repo"), "unit");
  const second = normalizeJUnitReport(junitWithRuntime("0.991", "/repo"), "unit");
  assert.equal(first, second);
  assert.doesNotMatch(first, /duration|C:\\repo|\/repo|postgresql:\/\//u);
  ```

- [x] **Step 2: eseguire i test RED**

  Run: `node --test tests/unit/test-report-policy.test.mjs tests/security/test-report-security.test.mjs`

  Expected: `FAIL` perché policy e CLI report non esistono.

- [x] **Step 3: implementare output normalizzato e manifest**

  JUnit finale ordina per lane e nome, imposta `time="0"`, converte failure in codice/messaggio statico e rimuove stack/output grezzo. I nomi già nel formato `TASK-ID:case-slug` vengono validati contro `knownTaskIds`; i test legacy mantengono il nome e ricevono `classname="<lane>"`, mentre il manifest collega il report agli `ownerTaskIds` della corsia. ID espliciti duplicati o sconosciuti falliscono chiusi. LCOV converte `SF:` in path POSIX relativi, ordina record e preserva soltanto `TN/SF/FN/FNDA/FNF/FNH/BRDA/BRF/BRH/DA/LH/LF/end_of_record`.

  Il manifest deve avere forma esatta:

  ```json
  {
    "schemaVersion": "testing-foundation-v1",
    "commit": "0123456789abcdef0123456789abcdef01234567",
    "lanes": ["unit", "integration", "database", "contract"],
    "taskIds": ["QA-001"],
    "tests": { "failed": 0, "passed": 1, "skipped": 0, "total": 1 },
    "files": [
      { "path": "unit/junit.xml", "bytes": 256, "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" }
    ]
  }
  ```

  Il valore SHA nel test è calcolato dal buffer con `createHash("sha256")`; non hard-codare un digest fittizio nell'implementazione.

- [x] **Step 4: collegare reporter Node e coverage 80%**

  Per `unit`, il runner aggiunge:

  ```text
  --experimental-test-coverage
  --test-coverage-include=packages/testing/dist/**/*.js
  --test-coverage-branches=80
  --test-coverage-functions=80
  --test-coverage-lines=80
  --test-reporter=spec --test-reporter-destination=stdout
  --test-reporter=junit --test-reporter-destination=test-results/testing-foundation-v1/unit/raw/junit.xml
  --test-reporter=lcov --test-reporter-destination=test-results/testing-foundation-v1/unit/raw/coverage.lcov
  ```

  Le altre corsie usano `spec` + `junit`. Un report mancante o cleanup fallito mantiene exit non-zero anche se i test sono verdi.

- [x] **Step 5: verificare GREEN e riproducibilità**

  Run: `corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/testing && node --test tests/unit/test-report-policy.test.mjs tests/security/test-report-security.test.mjs && node scripts/run-tests.mjs unit && node scripts/prepare-test-reports.mjs --required=unit && node scripts/verify-test-reports.mjs --required=unit`

  Expected: `PASS`; due prepare consecutivi sullo stesso commit producono gli stessi hash file nel manifest.

- [x] **Step 6: commit funzionale**

  ```bash
  git add scripts/lib/test-report-policy.mjs scripts/prepare-test-reports.mjs scripts/verify-test-reports.mjs scripts/run-tests.mjs tests/unit/test-report-policy.test.mjs tests/security/test-report-security.test.mjs tests/fixtures/testing
  git commit -m "feat(testing): add deterministic test reports"
  ```

### Task 5: Comandi pubblici, CI e documentazione living

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/lib/ci-workflow-policy.mjs`
- Modify: `tests/contracts/ci-workflow.test.mjs`
- Create: `docs/testing/TEST_STRATEGY.md`
- Modify: `docs/README.md`
- Modify: `docs/CONTEXT.md`
- Modify: `docs/TASKS.md`
- Modify: `docs/TRACEABILITY.md`
- Modify: `docs/operations/CI_CD.md`
- Modify: `docs/architecture/SYSTEM_OVERVIEW.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/superpowers/plans/2026-07-16-qa-001-test-foundation.md`

**Interfaces:**
- Produces: script pubblici invariati `test:unit`, `test:integration`, `db:migrate:test`, `test:contract`, `test:security`; aggiunge `test:all`, `test:reports:prepare`, `test:reports:verify`.
- Produces: job Tests che valida e carica `artifacts/testing` con retention `7`, `if-no-files-found: error` e action già pin a SHA.
- Produces: `docs/testing/TEST_STRATEGY.md` come contratto operativo di `testing-foundation-v1` e ownership separata `QA-002` per browser/a11y/visual.

- [x] **Step 1: scrivere il contract test CI RED**

  Estendere `validateCiDocuments` e il test per richiedere dopo le quattro suite della job Tests:

  ```yaml
  - name: Prepare test reports
    run: pnpm test:reports:prepare --required=unit,integration,database,contract

  - name: Verify test reports
    run: pnpm test:reports:verify --required=unit,integration,database,contract

  - name: Upload test reports
    uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a
    with:
      name: dnd-ai-tests-${{ github.sha }}
      path: artifacts/testing
      if-no-files-found: error
      retention-days: 7
  ```

  Il negative test deve rifiutare path più ampio, retention >7, report verification assente e `continue-on-error`.

- [x] **Step 2: eseguire il test RED CI**

  Run: `node --test tests/contracts/ci-workflow.test.mjs`

  Expected: `FAIL` con comandi/report artifact mancanti.

- [x] **Step 3: collegare package scripts, workflow e policy**

  Sostituire le invocazioni Node duplicate nei cinque script pubblici con `node scripts/run-tests.mjs <lane>`. `test:security` mantiene `node scripts/scan-secrets.mjs` dopo la corsia. `verify` usa `node scripts/run-tests.mjs all`, prepara/verifica il report e conserva tutti gli altri gate correnti.

  Run: `node --test tests/contracts/ci-workflow.test.mjs tests/integration/ci-gate.test.mjs`

  Expected: `PASS`; il merge gate e i nomi job restano invariati.

- [x] **Step 4: scrivere TEST_STRATEGY e allineare living docs**

  Documentare comandi, lane catalog, environment allowlist, fixture/test ID, container lifecycle, output/report schema, coverage, failure behavior, troubleshooting Docker e separazione QA-001/QA-002. Aggiornare QA-001 a `IN_REVIEW/90%/PASSING` soltanto dopo i mirati; `DONE/100%/PASSING` soltanto dopo il gate finale.

- [x] **Step 5: eseguire tutti i test mirati del task**

  Run:

  ```text
  corepack pnpm@11.13.0 turbo run build --filter=@dnd-ai/testing
  node --test tests/unit/testing-primitives.test.mjs tests/unit/test-container-lifecycle.test.mjs tests/unit/test-lane-policy.test.mjs tests/unit/test-report-policy.test.mjs
  node --test tests/integration/test-runner.test.mjs
  node --test --test-concurrency=1 tests/integration/testing-containers.test.mjs
  node --test tests/contracts/testing-package-contract.test.mjs tests/contracts/ci-workflow.test.mjs
  node --test tests/security/test-report-security.test.mjs
  corepack pnpm@11.13.0 db:migrate:test
  corepack pnpm@11.13.0 verify:docs
  corepack pnpm@11.13.0 audit --audit-level=high
  ```

  Expected: tutti exit `0`; PostgreSQL e Redis smoke reali, report policy, workflow policy, migration regressions, docs e audit `PASS`.

- [x] **Step 6: eseguire il solo full gate HIGH_RISK sul candidato**

  Run: `TURBO_FORCE=true corepack pnpm@11.13.0 verify`

  Expected: exit `0`; nessun retry, skip nuovo o test indebolito.

- [x] **Step 7: clean-checkout verification**

  Creare un worktree temporaneo sibling dal candidate HEAD, eseguire `corepack pnpm@11.13.0 install --frozen-lockfile`, `TURBO_FORCE=true corepack pnpm@11.13.0 verify`, poi rimuovere soltanto quel worktree dopo averne verificato il path assoluto.

  Expected: install e full gate exit `0`; report/artifact restano confinati e non modificano file tracked.

- [x] **Step 8: review finale, stato e commit candidato**

  Rileggere diff, report e secret scan; correggere soltanto finding P0/P1 reali. Aggiornare task, contesto e tracciabilità con comandi/exit code effettivi e stato branch-local proposto `DONE/100%/PASSING`.

  ```bash
  git add package.json .github/workflows/ci.yml scripts tests packages/testing docs
  git commit -m "test: establish deterministic test foundation"
  ```

- [ ] **Step 9: delivery protetta senza Vercel**

  Push della sola branch `codex/qa-001-test-foundation`, una PR verso `main`, attesa di `CI / Merge gate`, merge senza bypass e readback della run post-merge. Non eseguire deploy, promote, redeploy, bootstrap o modifiche Vercel.
