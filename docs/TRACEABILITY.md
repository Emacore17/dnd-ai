---
status: active
owner: engineering-and-qa
last_reviewed: 2026-07-15
last_verified_commit: f9fbb24be26e45d00f425a762ba90bc559f038b3
source_refs:
  - docs/MVP_SPEC.md#32-criteri-di-accettazione
  - docs/TASKS.md
  - docs/product/UX_UI_DESIGN.md
  - docs/adr/0007-observability-context-and-error-reporting.md
  - docs/adr/0008-zod-first-contract-generation.md
  - docs/superpowers/specs/2026-07-15-bl-010-feature-flags-design.md
  - docs/superpowers/specs/2026-07-15-gov-002-document-integrity-design.md
  - docs/adr/README.md
related_tasks:
  - GOV-001
  - GOV-002
  - BL-001
  - BL-002
  - BL-003
  - BL-004
  - BL-008
  - BL-009
  - BL-010
  - BL-040
  - BL-079
  - BL-080
code_refs:
  - apps
  - packages
  - packages/config
  - packages/observability
  - packages/contracts/src
  - packages/contracts/generated/v1
  - scripts/generate-contracts.mjs
  - scripts/lib/contract-artifact-policy.mjs
  - scripts/lib/contract-compatibility-policy.mjs
  - scripts/lib/owned-path-policy.mjs
  - apps/api/src/observability.ts
  - apps/worker/src/observability.ts
  - apps/web/instrumentation.ts
  - apps/web/instrumentation-client.ts
  - apps/api/src/runtime.ts
  - apps/worker/src/runtime.ts
  - scripts/lib/workspace-boundaries.mjs
  - scripts/lib/task-graph.mjs
  - scripts/lib/document-policy.mjs
  - scripts/lib/document-integrity-policy.mjs
  - scripts/lib/markdown-document.mjs
  - scripts/lib/mermaid-policy.mjs
  - scripts/validate-mermaid-worker.mjs
  - .github/workflows/ci.yml
  - scripts/lib/ci-workflow-policy.mjs
  - scripts/lib/build-artifact.mjs
  - scripts/lib/secret-scanner.mjs
  - infra/deployment/vercel-staging.json
  - apps/web/package.json
  - apps/web/vercel.json
  - apps/web/scripts/assert-vercel-preview-build.mjs
  - apps/web/scripts/vercel-preview-build-policy.mjs
  - .vercelignore
  - turbo.json
  - .github/workflows/deployment-smoke.yml
  - scripts/check-deployment-foundation.mjs
  - scripts/assert-vercel-preview-bootstrap-enabled.mjs
  - scripts/lib/deployment-foundation.mjs
  - scripts/check-vercel-deploy-dry-run.mjs
  - scripts/lib/vercel-deploy-dry-run.mjs
  - scripts/lib/deployment-smoke.mjs
  - packages/persistence
  - packages/persistence/src/feature-flags.ts
  - packages/persistence/src/migrations/000002_feature_flags.ts
  - scripts/manage-feature-flag.mjs
  - scripts/run-database-migrations.mjs
  - scripts/lib/database-migration-policy.mjs
  - scripts/lib/postgres-test-container.mjs
  - infra/local/postgres.compose.yml
test_refs:
  - AGENTS_VALIDATION.txt
  - tests/contracts/workspace-boundaries.test.mjs
  - tests/contracts/task-graph.test.mjs
  - docs/testing/BL-001_VERIFICATION.md
  - tests/contracts/ci-workflow.test.mjs
  - tests/contracts/document-policy.test.mjs
  - tests/contracts/document-integrity.test.mjs
  - tests/integration/ci-gate.test.mjs
  - docs/testing/BL-002_VERIFICATION.md
  - tests/unit/build-artifact.test.mjs
  - tests/unit/runtime-config.test.mjs
  - tests/integration/runtime-startup.test.mjs
  - tests/contracts/runtime-config-contract.test.mjs
  - tests/security/environment-file-policy.test.mjs
  - docs/testing/BL-003_VERIFICATION.md
  - tests/unit/deployment-smoke.test.mjs
  - tests/integration/web-health.test.mjs
  - tests/contracts/deployment-foundation.test.mjs
  - tests/security/deployment-smoke-security.test.mjs
  - tests/unit/vercel-preview-build-policy.test.mjs
  - tests/security/vercel-preview-build-guard.test.mjs
  - tests/unit/vercel-preview-bootstrap-policy.test.mjs
  - tests/security/vercel-preview-bootstrap-gate.test.mjs
  - tests/unit/vercel-deploy-dry-run.test.mjs
  - tests/security/vercel-deploy-dry-run.test.mjs
  - docs/testing/BL-080_VERIFICATION.md
  - tests/database/database-migrations.test.mjs
  - tests/database/database-migration-cli.test.mjs
  - tests/database/database-migration-failure.test.mjs
  - tests/unit/database-migration-policy.test.mjs
  - tests/contracts/database-migration-contract.test.mjs
  - tests/security/database-migration-security.test.mjs
  - tests/unit/feature-flags.test.mjs
  - tests/database/feature-flags.test.mjs
  - tests/security/feature-flags-security.test.mjs
  - docs/testing/BL-004_VERIFICATION.md
  - tests/unit/observability-core.test.mjs
  - tests/unit/observability-node.test.mjs
  - tests/integration/observability-flow.test.mjs
  - tests/contracts/observability-contract.test.mjs
  - tests/security/observability-security.test.mjs
  - tests/contracts/contracts-foundation.test.mjs
  - tests/contracts/contracts-runtime.test.mjs
  - tests/contracts/contracts-artifacts.test.mjs
  - tests/contracts/contracts-generated.test.mjs
  - tests/unit/contract-artifact-policy.test.mjs
  - tests/contracts/contracts-compatibility.test.mjs
  - tests/unit/owned-path-policy.test.mjs
supersedes: null
---

# Tracciabilità MVP

## Stato del registro

Il repository pubblico è versionato e collegato a `Emacore17/dnd-ai`. `BL-001` ha introdotto lo scaffold applicativo, `BL-002` pipeline/Ruleset e `BL-003` config/startup fail-fast. `BL-004`, `BL-008`, `BL-009` e `BL-010` sono `DONE/100%/PASSING` e integrati su `main`; BL-009 è verificato tramite PR #21/merge `8e6e0d3d46daa057ba80999c58c83ad1c92471b1` e run post-merge `29420929180`, BL-010 tramite PR #22/merge `15382d547638333e33992be96479a6f0cbff1a29` e run post-merge `29426357415`, entrambe 5/5 `SUCCESS`. `GOV-002` è candidato `IN_REVIEW` locale; `BL-080` resta congelato e `BL-079` resta `BACKLOG` fino allo staging reale.

## Governance e baseline

| Requisito | Fonte | Task | Artefatto | Test/evidenza | Stato |
|---|---|---|---|---|---|
| Cold start riproducibile | `AGENTS.md` §2; `docs/TASKS.md` §§3, 6 | GOV-001 | `AGENTS.md`, `docs/README.md`, `docs/CONTEXT.md`, `docs/TASKS.md` | `AGENTS_VALIDATION.txt` | implemented |
| Contesto con hash/data/versioni | `docs/TASKS.md` §6.3 | GOV-001 | `docs/CONTEXT.md` | cold-start review in `AGENTS_VALIDATION.txt` | implemented |
| Link, anchor e riferimenti documentali validi | `AGENTS.md` §12.3; spec §§26.12, 32.3, 35.1 | GOV-001, GOV-002, GOV-003 | documenti attivi, `scripts/lib/document-integrity-policy.mjs`, registro ADR e worker Mermaid | `tests/contracts/document-policy.test.mjs`, `tests/contracts/document-integrity.test.mjs`; `pnpm docs:check` verifica generated drift, metadata/freshness, path/ref/link/anchor, section refs, ADR, Mermaid e task graph | implemented locally, targeted PASS; full/clean/CI pending |
| Requisito→task→test→evidenza | `docs/TASKS.md` §6 | GOV-001, GOV-002 | questo documento | mapping GOV-002 verso policy Markdown/Mermaid/ADR, contract test e comandi riproducibili | implemented locally, targeted PASS |
| Monorepo buildabile con tre runtime e package puri | spec §§11.2–11.3; `AGENTS.md` §9 | BL-001 | `apps/*`, `packages/*`, `turbo.json` | lint/typecheck/build su 10 workspace; report BL-001 | implemented, clean worktree PASS |
| Import e dipendenze rispettano la allowlist | `AGENTS.md` §§4.6, 9 | BL-001 | `scripts/lib/workspace-boundaries.mjs` | `tests/contracts/workspace-boundaries.test.mjs`, inclusa fixture vietata; report BL-001 | implemented, PASS |
| Task ID, dipendenze, cicli, status, parity spec e riferimenti UI sono verificabili | `docs/TASKS.md` §§2, 7; studio UX §14.1 | BL-001, GOV-002 | `scripts/lib/task-graph.mjs` | `tests/contracts/task-graph.test.mjs`; `pnpm tasks:check` e gate composto `pnpm docs:check`; report BL-001 | implemented, PASS |
| DTO API/evento/output AI hanno validazione runtime e artefatti interoperabili versionati | spec §§11.5, 12.6, 12.8, 19.1, 20.1, 20.4, 20.6, 29.4; ADR-0008 | BL-009 | `packages/contracts/src`, `packages/contracts/generated/v1`, generator e policy drift/compatibility/owned path | runtime strict con UUIDv7 e version gate; Ajv 2020 parity; OpenAPI 3.1.1 components-only; breaking v1, base Git assente, missing/stale/unexpected, root junction e CI depth/base test | implemented; mirati 55 contract + 7 unit e full contract 56/56 PASS; review senza P0/P1; clean/CI pending |
| PR CI fail-closed con check stabile | spec §§26.12, 29.4; ADR-0003 | BL-002 | `.github/workflows/ci.yml`, `scripts/lib/ci-gate.mjs` | clean verify head `7c6c707`; PR run `29257544214`; post-merge run `29257721274`; run negativa `29256736728`; Ruleset `18877721`; report BL-002 | PASS |
| Dependency audit high usa un client bulk-capable senza downgrade | spec §§22.10, 26.12, 29.4; ADR-0003 | BL-002, BL-008 | pin pnpm `11.13.0`, setup action e policy progetto in `pnpm-workspace.yaml`; stale deps falliscono senza install implicito; comando audit esatto senza ignore | `tests/contracts/ci-workflow.test.mjs`, inclusa regressione `--ignore-registry-errors`; `tests/contracts/observability-contract.test.mjs`; PR #20 e run post-merge `29415397361` | PASS locale/CI |
| Cache e artifact non espongono credenziali | spec §§22.10, 29.4; ADR-0003 | BL-002 | setup action pnpm-only, `scripts/lib/secret-scanner.mjs`, `scripts/lib/build-artifact.mjs` | remote manifest `build-artifact-v1`, 3.205 file e checksum/secret verification; report BL-002 | PASS |
| Log CI non espongono credenziali | spec §§22.10, 29.4; ADR-0003 | BL-002 | workflow senza secret applicativi; output scanner redatto | scan redatto dei 5 job della run `29254494868` | PASS |
| Gate fallito rende la PR non mergeabile | spec §31 `BL-002`; card BL-002 | BL-002 | Ruleset `main-required-ci` `18877721` | PR negativa #3/run `29256736728`: gate FAIL e `mergeStateStatus=BLOCKED`; regole `main` verificate via API | PASS |
| Config runtime tipizzata e service-scoped | spec §§5, 22.10, 29.3; ADR-0004 | BL-003 | `packages/config`, API/worker composition root | unit 7/7; integration process 5/5; full verify locale/clean; CI `29285998646`; report BL-003 | DONE; PASS locale/clean/CI |
| Startup fallisce prima degli effetti su config mancante/malformata | spec §31 `BL-003`; card BL-003 | BL-003 | `apps/api/src/runtime.ts`, `apps/api/src/start.ts`, `apps/worker/src/runtime.ts` | listener reale, factory/initializer ordering, exit non-zero | PASS mirato |
| Secret template/injection senza leakage | spec §22.10; ADR-0004 | BL-003, BL-080 | template service-scoped, scanner fail-closed; web con zero secret/variabili applicative; Git Integration reale senza token Vercel persistente; emissione OIDC e Trusted Source exact-match abilitate | config/security suite; environment GitHub e progetto Vercel con zero secret applicativi; token mancante/malformato fail-before-fetch | BL-003 PASS; BL-080 boundary/trust OIDC PASS, activation parziale |
| Migration PostgreSQL riproducibili e versionate | spec §§19.5, 26.4, 29.5; ADR-0006 | BL-004, BL-010 | `packages/persistence`, `scripts/run-database-migrations.mjs`, `infra/local/postgres.compose.yml` | zero→head `000002_feature_flags`, previous→head da `000001`, replay, source/contract drift, file sconosciuto pre-DDL, due runner simultanei, vincoli/indice, rollback/re-apply su PostgreSQL 17/pgvector 0.8.2 | suite DB 15/15 PASS su branch BL-010; full gate locale PASS; CI pending |
| Rollback database fail-closed e forward-only gestito | spec §§19.5, 29.5; ADR-0006 | BL-004 | policy CLI e runbook `DATABASE_MIGRATIONS.md` | DDL invalido annullato con ledger 0; `down` solo loopback disposable senza query routing e con conferma; staging/production rifiutati | PASS mirato/full/clean/CI |
| Feature flag e kill switch server-side sono condivisi, auditati e fail-closed | spec §§22.16, 27.5, 28.6, 29.8, 31 `BL-010`; ADR-0004, ADR-0006, ADR-0007 | BL-010 | `packages/persistence/src/feature-flags.ts`, `packages/persistence/src/migrations/000002_feature_flags.ts`, `scripts/manage-feature-flag.mjs` | catalogo chiuso `campaign.start`/`turn.new`/`model.route.premium`; store unavailable/unknown/malformed disabled; cambio CLI senza deploy; audit atomico; CAS; idempotency replay/conflict; output redatto | unit feature flags 4/4, database feature flags 2/2 con replay post-toggle, security feature flags 4/4 e full gate locale PASS; PR/CI pending |
| W3C Trace Context e request ID attraversano web→API→queue→worker senza context bleed | spec §§24.1, 24.5; ADR-0007 | BL-008 | `packages/observability`, plugin Fastify e wrapper worker | `tests/integration/observability-flow.test.mjs`: parent chain `web.request`→`api.request`→`queue.enqueue`→`worker.process`, due flussi concorrenti disgiunti; PR #20/run `29415397361` | PASS mirato/full/clean/CI |
| Log JSON e metadata telemetry non espongono PII, secret, prompt o output AI | spec §§22.10, 24.2; ADR-0007 | BL-008 | sanitizer bounded, logger Pino allowlisted e reporter safe | `tests/unit/observability-core.test.mjs`, `tests/unit/observability-node.test.mjs`, `tests/security/observability-security.test.mjs`; PR #20/run `29415397361` | PASS mirato/full/clean/CI |
| Sentry resta error-only, off-by-default e non altera il risultato applicativo | spec §§24.4, 24.5; ADR-0007 | BL-008 | adapter Node/Next, transport fake, failure containment idempotente e bounded | unit/integration/security: exporter, destination e transport failure; zero rete; nessun Replay/profiling/log forwarding/tunnel/source map; PR #20/run `29415397361` | PASS mirato/full/clean/CI |
| Boundary browser/Node e startup config osservabilità falliscono in modo sicuro | spec §§11.3, 24.4; ADR-0004, ADR-0007 | BL-008 | export root browser-safe e `/node`; config DSN service-scoped; entrypoint Next lazy | `tests/contracts/observability-contract.test.mjs`, runtime config/startup integration, artifact client e PR #20/run `29415397361` | PASS mirato/full/clean/CI |
| Preview/staging M0 disponibile prima dei consumer deployabili | spec §§29.3–29.4, §30, §31 `BL-080`; DoD §35.1 | BL-003, BL-080, GATE-M0 | foundation, `/health`, progetto collegato, protezioni, Git auto-deploy spento e guard Preview-only | PR #12 e CLI su `1060228` entrambi Production/rimossi; freeze PR #16/merge `aa9342d`, CI `29343319207`/`29343526054` verdi e zero deploy; audit omissione client + ipotesi first-deployment + issue CLI `#17069` | BL-080 BLOCKED/PARTIAL; nessuno staging; serve fix/workaround provider; BL-079 BACKLOG |
| Build provider limitato a Preview senza leakage | spec §§22.10, 29.3–29.4; ADR-0005 proposed | BL-080 | `apps/web/vercel.json`, build script dedicato, policy pura e target metadata nella cache Turbo | unit policy, security subprocess e contract deployment versionati; build Vercel richiede `VERCEL=1`, `VERCEL_ENV=preview`, `VERCEL_TARGET_ENV=preview`; locale ammesso solo con tutti assenti | guard integrato; secondo record Production `ERROR`, ma log post-rimozione insufficienti per attribuire l'errore al guard |
| Payload CLI minimo e verificato prima di creare deployment | spec §§22.10, 29.3–29.4; ADR-0005 proposed | BL-080 | `.vercelignore`, dry-run parser e deployment foundation contract | test unit/security/contract; dry-run `nextjs` dalla root con 158 entry e 1.093.594 byte; mode/hash/symlink, cache/output/env/path non relativi e budget oltre soglia falliscono chiusi | PR #15/merge `1060228`, CI PR/post-merge verdi; contratto payload PASS |
| Creazione manuale fail-closed nel percorso approvato | spec §§29.3–29.4, §31 `BL-080`; ADR-0005 proposed | BL-080 | `source.manualDeployment.enabled=false`, `scripts/assert-vercel-preview-bootstrap-enabled.mjs` | unit policy, security subprocess statico e contract manifest; `deploy:bootstrap:check` expected exit `1`; PR #16 CI/post-merge 5/5 | interlock procedurale integrato; non è enforcement provider contro owner; riapertura vietata senza fix/workaround Preview-only supportato |
| Deploy web riconducibile a project/deployment/SHA/ref/repository/regione | spec §29.4; ADR-0005 proposed | BL-080 | `web-health-v1`, smoke fail-closed, manifest unlinked dopo PR #13 | dispatch Production rifiutato; run `29331534774` skipped; secondo record senza nuovo smoke; URL/alias rimossi `404` | controllo di rifiuto PASS; requisito Preview BLOCKED sul provider |

## UX/UI P0

| ID | Requisito normativo | Task | Codice | Test | Evidenza corrente |
|---|---|---|---|---|---|
| UX-P0-01 | Core loop completo a 320 px; baseline 360–430 px | BL-079, BL-040 | `apps/web` (planned) | `tests/e2e/mobile-game-loop.spec.ts` (planned) | studio e ADR approvati |
| UX-P0-02 | Feed conversazionale, decisione e composer dominano il primo livello | BL-079, BL-040 | `GameConversation`, `FreeActionComposer` (planned) | component + visual regression (planned) | `docs/product/UX_UI_DESIGN.md` §§4–7 |
| UX-P0-03 | HUD secondaria in drawer/sheet; desktop senza funzioni esclusive | BL-079, BL-040 | `GameDrawer`, responsive shell (planned) | viewport/browser matrix (planned) | ADR-0001 |
| UX-P0-04 | shadcn/ui `new-york` su Radix e token semantici | BL-079 | `components.json`, UI primitives (planned) | config/token contract test (planned) | ADR-0001 |
| UX-P0-05 | AI Elements selettivo non sostituisce `TurnView`, REST+SSE o idempotenza | BL-079, BL-040, BL-041 | adapter/wrapper UI (planned) | contract + UI negative test (planned) | spec §§11.4, 21.1 |
| UX-P0-06 | Motion lazy, reduced-motion e nessuna informazione affidata all’animazione | BL-079, BL-027, BL-040 | motion primitives (planned) | `tests/e2e/reduced-motion.spec.ts` (planned) | studio §11 |
| UX-P0-07 | Touch target ≥44 px, primarie ≥48 px, safe area/tastiera/zoom | BL-079, BL-012, BL-019, BL-040 | UI wrappers (planned) | accessibility/device E2E (planned) | spec §§8.4–8.5, 23.1 |
| UX-P0-08 | Stile premium contemporaneo, non pseudo-medievale | BL-079 | theme/tokens (planned) | design review + contrast/visual regression (planned) | studio §9 |
| UX-P0-09 | Dado decorativo riproduce risultato backend e possiede fallback | BL-040, BL-043 | dice tray (planned) | rules contract + reduced-motion UI test (planned) | spec §21.4 |

## Criteri globali

Il mapping completo AC-01..AC-25 è definito in `docs/TASKS.md` §19 e verrà sostituito qui con riferimenti reali man mano che codice e suite vengono creati. Fino ad allora, `docs/MVP_SPEC.md` §32.3 resta l’indice normativo sintetico.

## Regola di aggiornamento

Ogni task funzionale aggiunge o aggiorna almeno una riga con path reali. Un task non passa a `DONE` se il test richiesto è soltanto `planned`, salvo che il task sia esclusivamente documentale e disponga della propria evidenza riproducibile.
