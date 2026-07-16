---
status: active
owner: engineering-and-qa
last_reviewed: 2026-07-16
last_verified_commit: 7f2d4d0f360e83baf31404266df47cbee060be0d
source_refs:
  - docs/MVP_SPEC.md#26-strategia-di-testing
  - docs/MVP_SPEC.md#35-definition-of-done
  - docs/superpowers/specs/2026-07-16-qa-001-test-foundation-design.md
related_tasks:
  - QA-001
  - QA-002
  - BL-002
  - BL-004
  - BL-079
code_refs:
  - packages/testing/src
  - scripts/run-tests.mjs
  - scripts/lib/test-lane-policy.mjs
  - scripts/lib/test-process.mjs
  - scripts/lib/test-report-policy.mjs
  - scripts/prepare-test-reports.mjs
  - scripts/verify-test-reports.mjs
  - .github/workflows/ci.yml
test_refs:
  - tests/unit/testing-primitives.test.mjs
  - tests/unit/test-container-lifecycle.test.mjs
  - tests/unit/test-lane-policy.test.mjs
  - tests/unit/test-report-policy.test.mjs
  - tests/integration/test-runner.test.mjs
  - tests/integration/testing-containers.test.mjs
  - tests/contracts/testing-package-contract.test.mjs
  - tests/contracts/ci-workflow.test.mjs
  - tests/security/test-report-security.test.mjs
supersedes: null
---

# Strategia di test

## Scopo e responsabilità

`testing-foundation-v1` è il contratto comune delle suite non-browser. Fornisce un solo runner Node, processi isolati, primitive deterministiche, container PostgreSQL/Redis e report riproducibili. Ogni task di feature continua a possedere i propri casi di accettazione: questa fondazione non sostituisce test di dominio, API, sicurezza o database specifici.

`QA-002`, dopo `BL-079`, aggiungerà il contratto browser, accessibility e visual regression senza cambiare le corsie qui definite. Evals AI, load, chaos e release evidence restano assegnati ai task proprietari.

## Comandi pubblici

| Comando | Corsia o effetto |
|---|---|
| `pnpm test:unit` | `unit` |
| `pnpm test:integration` | `integration` |
| `pnpm db:migrate:test` | `database` |
| `pnpm test:contract` | `contract` |
| `pnpm test:security` | `security`, poi secret scan repository |
| `pnpm test:all` | tutte le cinque corsie in ordine canonico |
| `pnpm test:reports:prepare --required=<lane,...>` | ricostruisce `artifacts/testing` dai report richiesti |
| `pnpm test:reports:verify --required=<lane,...>` | verifica file set, checksum, manifest e contenuto sensibile |

Il runner accetta soltanto un nome di corsia o `all`. Un nome sconosciuto, una corsia vuota, un path test non regolare o esterno a `tests/`, un timeout o un report mancante producono exit non-zero. Non esistono retry automatici.

## Catalogo delle corsie

| Corsia | Pattern | Concorrenza | Timeout | Workspace costruiti |
|---|---|---:|---:|---|
| `unit` | `tests/unit/*.test.mjs` | 4 | 300 s | config, observability, persistence, testing |
| `integration` | `tests/integration/*.test.mjs` | 2 | 600 s | api, worker, web, testing |
| `database` | `tests/database/*.test.mjs` | 1 | 600 s | config, persistence, testing |
| `contract` | `tests/contracts/*.test.mjs` | 4 | 300 s | contracts, testing |
| `security` | `tests/security/*.test.mjs` | 2 | 300 s | config, observability, persistence, testing |

Ogni file viene scoperto tramite glob, risolto con `realpath`, ordinato e validato prima dello spawn. Le fixture intenzionalmente rosse vivono in `tests/fixtures/` e non appartengono a una corsia normale.

## Isolamento di processo e ambiente

Node viene avviato con `--test-isolation=process` e `shell: false`. Timeout e segnali terminano l’intero process tree; stdout/stderr hanno un limite di cattura e gli errori infrastrutturali esposti dal runner sono statici.

Il processo figlio riceve soltanto `CI`, `GITHUB_ACTIONS`, `HOME`, `LOCALAPPDATA`, `PATH`, `Path`, `PATHEXT`, `PNPM_HOME`, `RUNNER_OS`, `SYSTEMROOT`, `TEMP`, `TMP`, `TURBO_FORCE`, `USERPROFILE` e `WINDIR` quando presenti. `LOCALAPPDATA` e `PNPM_HOME` sono path di toolchain necessari a pnpm/Corepack su Windows; variabili applicative, URL database/Redis, `NODE_OPTIONS` e secret ambientali non vengono inoltrati.

## ID, fixture e determinismo

I nuovi test della fondazione usano `TASK-ID:case-slug`, per esempio `QA-001:seeded-rng-golden-sequence`. Il task ID deve essere noto alla corsia; slug non canonici, ID sconosciuti e duplicati espliciti falliscono durante la normalizzazione JUnit. I test legacy possono mantenere un nome descrittivo e vengono collegati agli `ownerTaskIds` nel manifest.

`@dnd-ai/testing` espone dal root soltanto primitive portabili:

- `createTestId` valida e crea ID canonici;
- `createSeededRng` usa la sequenza versionata `xorshift32-v1` e supporta snapshot;
- `createFakeClock` avanza solo in modo esplicito e monotono;
- `createFixtureFactory` clona e valida ogni valore prodotto.

Le API Docker sono disponibili esclusivamente da `@dnd-ai/testing/node`, così il root resta browser-safe.

## Container PostgreSQL e Redis

Il lifecycle usa direttamente Docker CLI con argomenti, senza shell e senza librerie container aggiuntive. Ogni istanza usa nome univoco, binding loopback su porta host casuale, readiness bounded e cleanup idempotente ma fail-visible.

| Servizio | Immagine immutabile | Readiness |
|---|---|---|
| PostgreSQL/pgvector | `pgvector/pgvector:0.8.2-pg17-trixie@sha256:5c97c57367a485a8e99389548db67d441ab1a878f5492c3df04989f34ecf3c75` | `pg_isready` |
| Redis | `redis:7.4.7-alpine3.21@sha256:02f2cc4882f8bf87c79a220ac958f58c700bdec0dfb9b9ea61b62fb0e8f1bfcf` | `redis-cli ping` |

Le suite devono arrestare i container in `finally`. Readiness timeout, output Docker non valido e cleanup fallito mantengono il test rosso; l’assenza di un container già rimosso è l’unico cleanup idempotente accettato.

## Coverage e report

La corsia `unit` usa la coverage nativa Node su `packages/testing/dist/**/*.js` con soglia minima 80% per linee, branch e funzioni. Le altre corsie producono JUnit senza coverage; i task di dominio aggiungeranno le proprie soglie quando esisterà codice di dominio reale.

I report intermedi sono confinati in `test-results/testing-foundation-v1/<lane>/raw/`. Il runner li normalizza e rimuove la directory `raw`:

- JUnit è ordinato, usa `time="0"`, non conserva stack/path/output runtime e riduce i failure a un messaggio statico;
- LCOV conserva soltanto record allowlisted, converte `SF:` in path POSIX relativi sotto `packages/testing/dist/` e ordina file e metriche;
- report troppo grandi, malformati, collegati, esterni al repository o contenenti credenziali/secret falliscono chiusi.

`artifacts/testing/manifest.json` usa lo schema `testing-foundation-v1` e contiene `commit`, `lanes`, `taskIds`, conteggi e file con byte e SHA-256. L’artifact viene ricreato da zero soltanto dopo il controllo dell’intera chain di path; file inattesi, symlink/junction, checksum errati o manifest incoerenti fanno fallire la verifica.

In CI il job Tests prepara e verifica `unit,integration,database,contract`, quindi carica soltanto `artifacts/testing` con retention di 7 giorni e `if-no-files-found: error`. Il job Security resta separato e fail-closed.

## Failure path e troubleshooting

1. Se Docker non risponde, avviare Docker Desktop e verificare `docker version`; non saltare la corsia database/container.
2. Se la readiness scade, ispezionare lo stato locale senza stampare environment o URL con credenziali; il runner ha già tentato il cleanup.
3. Se un report fallisce, rigenerare la singola corsia e non modificare a mano JUnit, LCOV o manifest.
4. Se una soglia coverage fallisce, aggiungere test comportamentali sul ramo mancante; non abbassare la soglia e non escludere file per ottenere verde.
5. Se il runner termina un processo appeso, correggere la causa o il fixture proprietario; non aumentare il timeout senza evidenza.

Nessun comando di questa strategia crea deployment o modifica Vercel.
