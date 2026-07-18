---
status: active
owner: engineering-and-qa
last_reviewed: 2026-07-18
last_verified_commit: b7d137f10f3602224704f9da65a3f226b6410139
source_refs:
  - docs/MVP_SPEC.md#32-criteri-di-accettazione
  - docs/TASKS.md
  - docs/product/UX_UI_DESIGN.md
  - docs/adr/0007-observability-context-and-error-reporting.md
  - docs/adr/0008-zod-first-contract-generation.md
  - docs/adr/0009-mvp-runtime-data-and-workflow-architecture.md
  - docs/adr/0010-internal-provider-neutral-identity.md
  - docs/superpowers/specs/2026-07-16-bl-005-signup-verification-design.md
  - docs/superpowers/specs/2026-07-16-bl-006-session-access-design.md
  - docs/superpowers/plans/2026-07-17-bl-006-session-access.md
  - docs/superpowers/specs/2026-07-17-bl-007-actor-context-design.md
  - docs/superpowers/specs/2026-07-15-bl-010-feature-flags-design.md
  - docs/superpowers/specs/2026-07-15-gov-002-document-integrity-design.md
  - docs/superpowers/specs/2026-07-16-qa-001-test-foundation-design.md
  - docs/superpowers/specs/2026-07-16-gov-004-unblock-ui-dependencies-design.md
  - docs/superpowers/plans/2026-07-16-bl-079-design-system-core.md
  - docs/superpowers/specs/2026-07-17-bl-081-interactive-game-shell-design.md
  - docs/superpowers/plans/2026-07-17-bl-081-interactive-game-shell.md
  - docs/superpowers/specs/2026-07-17-qa-002-browser-harness-design.md
  - docs/superpowers/plans/2026-07-17-qa-002-browser-harness.md
  - docs/testing/TEST_STRATEGY.md
  - docs/adr/README.md
related_tasks:
  - GOV-001
  - GOV-002
  - GOV-004
  - GOV-005
  - GATE-M0
  - BL-001
  - BL-002
  - BL-003
  - BL-004
  - BL-005
  - BL-006
  - BL-007
  - BL-008
  - BL-009
  - BL-010
  - BL-040
  - BL-079
  - BL-080
  - BL-081
  - QA-001
  - QA-002
  - DOC-ARCH-001
code_refs:
  - apps
  - apps/web/components.json
  - apps/web/app/globals.css
  - apps/web/app/layout.tsx
  - apps/web/components/ai-elements
  - apps/web/components/game
  - apps/web/components/ui
  - apps/web/lib/game-shell
  - packages
  - packages/config
  - packages/observability
  - packages/contracts/src
  - packages/contracts/generated/v1
  - packages/contracts/generated/v2
  - packages/contracts/generated/v3
  - packages/contracts/generated/v4
  - apps/api/src/campaign
  - apps/api/src/access/owned-sse-authorization.ts
  - packages/domain/src/access/actor-context.ts
  - packages/persistence/src/campaign-access-store.ts
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
  - packages/persistence/src/migrations/000003_identity_signup.ts
  - packages/persistence/src/identity-store.ts
  - scripts/manage-feature-flag.mjs
  - scripts/run-database-migrations.mjs
  - scripts/lib/database-migration-policy.mjs
  - scripts/lib/postgres-test-container.mjs
  - infra/local/postgres.compose.yml
  - packages/testing/src
  - scripts/run-tests.mjs
  - scripts/lib/test-report-policy.mjs
  - tests/e2e/playwright.config.mjs
  - tests/e2e/start-web-server.mjs
test_refs:
  - AGENTS_VALIDATION.txt
  - tests/contracts/web-design-system.test.mjs
  - tests/integration/web-game-shell.test.mjs
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
  - tests/unit/testing-primitives.test.mjs
  - tests/unit/test-container-lifecycle.test.mjs
  - tests/unit/test-report-policy.test.mjs
  - tests/integration/test-runner.test.mjs
  - tests/integration/testing-containers.test.mjs
  - tests/contracts/testing-package-contract.test.mjs
  - tests/security/test-report-security.test.mjs
  - tests/contracts/browser-harness-contract.test.mjs
  - tests/e2e/game-shell.spec.mjs
  - tests/e2e/accessibility.spec.mjs
  - tests/e2e/harness-failures.spec.mjs
  - tests/unit/observability-core.test.mjs
  - tests/unit/observability-node.test.mjs
  - tests/integration/observability-flow.test.mjs
  - tests/contracts/observability-contract.test.mjs
  - tests/security/observability-security.test.mjs
  - tests/contracts/contracts-foundation.test.mjs
  - tests/contracts/contracts-runtime.test.mjs
  - tests/contracts/contracts-artifacts.test.mjs
  - tests/contracts/contracts-generated.test.mjs
  - tests/contracts/identity-contracts.test.mjs
  - tests/contracts/web-identity-ui.test.mjs
  - tests/contracts/campaign-contracts.test.mjs
  - tests/database/campaign-ownership-migration.test.mjs
  - tests/database/campaign-access-store.test.mjs
  - tests/integration/campaign-idor-flow.test.mjs
  - tests/security/campaign-access-security.test.mjs
  - tests/integration/identity-signup-flow.test.mjs
  - tests/security/identity-api-security.test.mjs
  - tests/security/identity-email-security.test.mjs
  - tests/unit/contract-artifact-policy.test.mjs
  - tests/contracts/contracts-compatibility.test.mjs
  - tests/unit/owned-path-policy.test.mjs
  - tests/contracts/architecture-documentation.test.mjs
supersedes: null
---

# Tracciabilità MVP

## Stato del registro

Il repository pubblico è versionato e collegato a `Emacore17/dnd-ai`. `BL-001` ha introdotto lo scaffold applicativo, `BL-002` pipeline/Ruleset e `BL-003` config/startup fail-fast. `BL-004`, `BL-005`, `BL-006`, `BL-007`, `BL-008`, `BL-009`, `BL-010`, `BL-079`, `BL-081`, `GOV-002`, `GOV-004`, `GOV-005`, `QA-001`, `QA-002` e `DOC-ARCH-001` sono `DONE/100%/PASSING` e integrati su `main`. `GATE-M0` è proposto `DONE/100%/PASSING` branch-local con full gate locale verde e sblocca `BL-011`. `GOV-005` riallinea il programma sulla priorità local-first: completare il playable loop locale con AI integrata dietro adapter. `BL-080` resta congelato/bloccato come gate remoto.

## Governance e baseline

| Requisito | Fonte | Task | Artefatto | Test/evidenza | Stato |
|---|---|---|---|---|---|
| Cold start riproducibile | `AGENTS.md` §2; `docs/TASKS.md` §§3, 6 | GOV-001 | `AGENTS.md`, `docs/README.md`, `docs/CONTEXT.md`, `docs/TASKS.md` | `AGENTS_VALIDATION.txt` | implemented |
| Contesto con hash/data/versioni | `docs/TASKS.md` §6.3 | GOV-001 | `docs/CONTEXT.md` | cold-start review in `AGENTS_VALIDATION.txt` | implemented |
| Link, anchor e riferimenti documentali validi | `AGENTS.md` §12.3; spec §§26.12, 32.3, 35.1 | GOV-001, GOV-002, GOV-003 | documenti attivi, `scripts/lib/document-integrity-policy.mjs`, registro ADR e worker Mermaid | `tests/contracts/document-policy.test.mjs`, `tests/contracts/document-integrity.test.mjs`; `pnpm docs:check` verifica generated drift, metadata/freshness, path/ref/link/anchor, section refs, ADR, Mermaid e task graph | DONE; PR #23/merge `a698592`, CI post-merge `29433127921` 5/5 `SUCCESS` |
| Requisito→task→test→evidenza | `docs/TASKS.md` §6 | GOV-001, GOV-002 | questo documento | mapping GOV-002 verso policy Markdown/Mermaid/ADR, contract test e comandi riproducibili | DONE; PR #23/merge `a698592`, CI post-merge `29433127921` 5/5 `SUCCESS` |
| Monorepo buildabile con tre runtime e package puri | spec §§11.2–11.3; `AGENTS.md` §9 | BL-001 | `apps/*`, `packages/*`, `turbo.json` | lint/typecheck/build su 10 workspace; report BL-001 | implemented, clean worktree PASS |
| Import e dipendenze rispettano la allowlist | `AGENTS.md` §§4.6, 9 | BL-001 | `scripts/lib/workspace-boundaries.mjs` | `tests/contracts/workspace-boundaries.test.mjs`, inclusa fixture vietata; report BL-001 | implemented, PASS |
| Task ID, dipendenze, cicli, status, parity spec e riferimenti UI sono verificabili | `docs/TASKS.md` §§2, 7; studio UX §14.1 | BL-001, GOV-002 | `scripts/lib/task-graph.mjs` | `tests/contracts/task-graph.test.mjs`; `pnpm tasks:check` e gate composto `pnpm docs:check`; report BL-001 | implemented, PASS |
| Fondazione UI locale separata da shell interattiva e smoke remoto | spec §31; ADR-0001; studio UX §14 | GOV-004, BL-079, BL-081, BL-080, QA-002 | design/piani, `apps/web/components/{ai-elements,game}`, `apps/web/lib/game-shell` | task graph; contract design system/interazione; reducer; smoke standalone e browser locale | GOV-004/BL-079/BL-081/QA-002 integrati; BL-080 invariato BLOCKED |
| Roadmap local-first verso AI integrata | spec §30; `docs/TASKS.md` §7; decisione PO 2026-07-17 | GOV-005, GATE-M0, BL-011, BL-021, BL-023, BL-028..BL-041 | `docs/MVP_SPEC.md`, `docs/TASKS.md`, `docs/CONTEXT.md`; futuri `AIProvider`/`FakeAIProvider` e adapter reale configurabile localmente | `tasks:check`/`verify:docs` per il riallineamento; futuri contract test fake/adapter, fixture success/timeout/error/invalid schema/usage missing e E2E locale del turn loop | GOV-005 DONE/PASSING; `BL-080` non blocca più M1→M6 locale; `OD-06` resta da decidere prima dell'adapter reale |
| Exit gate locale M0 | spec §30 Milestone 0; spec §35.3; `docs/TASKS.md` `GATE-M0` | GATE-M0, BL-001..BL-010, BL-079, BL-081, QA-001, QA-002, DOC-ARCH-001 | workspace locale, PostgreSQL/Redis container harness, browser harness, config/secret/CI/deployment policy, artifact testing/build | primo `verify` exit 1 per Docker Desktop spento; `test:integration` 45/45 dopo avvio Docker; full `corepack pnpm@11.13.0 verify` exit 0 in 176,2 s; report 420 test, 416 pass, 4 skip host Windows, 0 fail; artifact build 4.396 file; secret scan e deployment foundation PASS | GATE-M0 proposto DONE/PASSING branch-local; `BL-011` READY; nessun deploy Vercel eseguito |
| Architettura living implementato/target | spec §§11, 29; ADR-0009 | DOC-ARCH-001 | `docs/architecture/SYSTEM_OVERVIEW.md`, ADR-0009 | `tests/contracts/architecture-documentation.test.mjs`, Mermaid parse e `verify:docs` | PASS; contract 3/3, docs gate e full HIGH_RISK verdi |
| Modello dati e migration head | spec §19; ADR-0006, ADR-0010 | DOC-ARCH-001, BL-005, BL-006 | `docs/data/DATA_MODEL.md`; `000004_identity_access` su main | architecture-documentation contract + migration contract/database/identity suite | `000004`/`database-identity-access-v1` verde su PostgreSQL reale per zero/previous→head, vincoli, replay, rollback e runner concorrenti; integrato tramite PR #29 |
| Cold start locale riproducibile | spec §29.3; card DOC-ARCH-001 | DOC-ARCH-001 | `docs/operations/LOCAL_DEVELOPMENT.md` | clean checkout + `web-health-v1`/runtime integration | PASS; frozen install, config, migration, build, integration 20/20 e health reale verdi |
| DTO API/evento/output AI hanno validazione runtime e artefatti interoperabili versionati | spec §§11.5, 12.6, 12.8, 19.1, 20.1, 20.4, 20.6, 29.4; ADR-0008 | BL-009 | `packages/contracts/src`, `packages/contracts/generated/v1`, generator e policy drift/compatibility/owned path | runtime strict con UUIDv7 e version gate; Ajv 2020 parity; OpenAPI 3.1.1 components-only; breaking v1, base Git assente, missing/stale/unexpected, root junction e CI depth/base test | DONE; PR #21/merge `8e6e0d3`, CI post-merge `29420929180` 5/5 `SUCCESS` |
| PR CI fail-closed con check stabile | spec §§26.12, 29.4; ADR-0003 | BL-002 | `.github/workflows/ci.yml`, `scripts/lib/ci-gate.mjs` | clean verify head `7c6c707`; PR run `29257544214`; post-merge run `29257721274`; run negativa `29256736728`; Ruleset `18877721`; report BL-002 | PASS |
| Dependency audit high usa un client bulk-capable senza downgrade | spec §§22.10, 26.12, 29.4; ADR-0003 | BL-002, BL-008 | pin pnpm `11.13.0`, setup action e policy progetto in `pnpm-workspace.yaml`; stale deps falliscono senza install implicito; comando audit esatto senza ignore | `tests/contracts/ci-workflow.test.mjs`, inclusa regressione `--ignore-registry-errors`; `tests/contracts/observability-contract.test.mjs`; PR #20 e run post-merge `29415397361` | PASS locale/CI |
| Cache e artifact non espongono credenziali | spec §§22.10, 29.4; ADR-0003 | BL-002 | setup action pnpm-only, `scripts/lib/secret-scanner.mjs`, `scripts/lib/build-artifact.mjs` | remote manifest `build-artifact-v1`, 3.205 file e checksum/secret verification; report BL-002 | PASS |
| Log CI non espongono credenziali | spec §§22.10, 29.4; ADR-0003 | BL-002 | workflow senza secret applicativi; output scanner redatto | scan redatto dei 5 job della run `29254494868` | PASS |
| Gate fallito rende la PR non mergeabile | spec §31 `BL-002`; card BL-002 | BL-002 | Ruleset `main-required-ci` `18877721` | PR negativa #3/run `29256736728`: gate FAIL e `mergeStateStatus=BLOCKED`; regole `main` verificate via API | PASS |
| Config runtime tipizzata e service-scoped | spec §§5, 22.10, 29.3; ADR-0004 | BL-003, DOC-ARCH-001 | `packages/config`, API/worker composition root e script composto root | unit 7/7; integration process 5/5; regressione `runtime-config-contract` sul pin Corepack dei subprocess; full verify locale/clean; CI `29285998646`; report BL-003 | DONE BL-003; regressione DOC-ARCH-001 6/6 e cold rerun PASS |
| Signup pending, verifica one-time e prima sessione sicura | spec §§20, 22.2, 22.8–22.10, 32 AC-01; ADR-0010 | BL-005 | `apps/api/src/identity`, `apps/worker/src/identity`, `apps/web/app/{sign-up,verify-email,api/auth}`, `apps/web/lib/server`, `packages/persistence/src/identity-store.ts`, migration `000003`, contract artifact `v2` | unit/DB/API/worker/BFF/UI/security; asserzione subject HMAC BFF→API; vertical `identity-signup-flow` su PostgreSQL reale; concorrenza, replay, supersession, timeout e rate limit | BL-005 integrato tramite PR #28; mirati, browser, full, clean checkout e CI PR/post-merge PASS |
| Login, session lifecycle, logout, revoca globale e reset one-time | spec §§20, 22.2, 22.8–22.12, 26.5, 26.8, 26.9 e 32 AC-01; ADR-0010; `identity-access-v1` | BL-006, QA-002 | contract artifact `v3`, porte/config/crypto, migration `000004_identity_access`, access store, service, sei route Fastify, worker outbox discriminato, sei route BFF e pagine `sign-in`, `reset-password`, `account/security` implementati | contract/config/crypto/startup e migration `PASS`; store PostgreSQL 2/2 + regressione 3/3 + security 2/2; service/cookie/API/security 20/20 e regressioni 23/23; worker build, unit/security 12/12 e integrazione PostgreSQL 6/6; web build/lint/typecheck e 19/19 BFF/client/UI/standalone; verticale `identity-access-flow` 1/1 e aggregato identity 96/96; browser 320/390/1440; full 355 test e artifact 4.332; clean head `df7f868` con install/artifact/build/migration/verticale/docs/secret verdi | DONE; PR #29/merge `c30c6db`, CI PR/post-merge 5/5 `SUCCESS` |
| AC-23 — isolamento campagne e accesso cross-tenant impossibile | spec §§20.1, 22.3, 32 AC-23; `campaign-ownership-v1` | BL-007 | `ActorContext`, `CampaignReader`, `app.campaigns`, artifact `v4`, `CampaignAccessStore`, GET owner-scoped e pre-handler SSE non registrato | `campaign-contracts`, `campaign-ownership-migration`, `campaign-access-store`, `campaign-api`, `campaign-idor-flow`, `campaign-access-security`: due utenti, foreign/missing/deleted, sessione revocata, 404 uniformi, DB 503, nessuno stream prima dell'auth | DONE; PR #31/merge `f653e63`, CI PR/post-merge 5/5 `SUCCESS` |
| Startup fallisce prima degli effetti su config mancante/malformata | spec §31 `BL-003`; card BL-003 | BL-003 | `apps/api/src/runtime.ts`, `apps/api/src/start.ts`, `apps/worker/src/runtime.ts` | listener reale, factory/initializer ordering, exit non-zero | PASS mirato |
| Secret template/injection senza leakage | spec §22.10; ADR-0004 | BL-003, BL-005, BL-006, BL-080 | template service-scoped, scanner fail-closed; BFF assertion key soltanto server-side con IP pseudonimo e nessun valore identity nel bundle client; BL-006 con chiave HMAC reset dedicata API/worker e controllo anti-riuso; Git Integration reale senza token Vercel persistente | config/security/BFF suite; header provider-controlled, firma/timestamp/tampering; secret reset fail-fast/redaction; token mancante/malformato fail-before-fetch | BL-003/BL-005 PASS; BL-006 config/crypto/security/secret scan e checkout pulito PASS; BL-080 boundary/trust OIDC PASS, activation parziale |
| Migration PostgreSQL riproducibili e versionate | spec §§19.5, 26.4, 29.5; ADR-0006 | BL-004, BL-010, BL-005, BL-006 | `packages/persistence`, `scripts/run-database-migrations.mjs`, `infra/local/postgres.compose.yml` | zero→head e previous→head, replay, source/contract drift, file sconosciuto pre-DDL, due runner simultanei, vincoli/indice, rollback/re-apply su PostgreSQL 17/pgvector 0.8.2 | `000004_identity_access` su main PASS: identity 2/2, lifecycle 11/11, concurrency/failure 2/2; PR #29 integrata |
| Rollback database fail-closed e forward-only gestito | spec §§19.5, 29.5; ADR-0006 | BL-004 | policy CLI e runbook `DATABASE_MIGRATIONS.md` | DDL invalido annullato con ledger 0; `down` solo loopback disposable senza query routing e con conferma; staging/production rifiutati | PASS mirato/full/clean/CI |
| Feature flag e kill switch server-side sono condivisi, auditati e fail-closed | spec §§22.16, 27.5, 28.6, 29.8, 31 `BL-010`; ADR-0004, ADR-0006, ADR-0007 | BL-010 | `packages/persistence/src/feature-flags.ts`, `packages/persistence/src/migrations/000002_feature_flags.ts`, `scripts/manage-feature-flag.mjs` | catalogo chiuso `campaign.start`/`turn.new`/`model.route.premium`; store unavailable/unknown/malformed disabled; cambio CLI senza deploy; audit atomico; CAS; idempotency replay/conflict; output redatto | DONE; PR #22/merge `15382d5`, CI post-merge `29426357415` 5/5 `SUCCESS` |
| Runner, fixture e report non-browser sono isolati e riproducibili | spec §§26, 35.1 | QA-001 | `@dnd-ai/testing`, runner Node root, harness PostgreSQL/Redis e artifact `testing-foundation-v1` | process isolation/failure/timeout, golden RNG/clock, smoke container concorrente, JUnit/LCOV/checksum e symlink/secret negative path | DONE; full + clean `PASS`, PR #24/merge `3e9c6d5`; [`TEST_STRATEGY.md`](testing/TEST_STRATEGY.md) |
| Browser, accessibility e visual regression usano un harness comune | spec §26.8; studio UX §§13–14.1; `browser-harness-v1` | BL-081, QA-002 | lane `e2e` Playwright nel runner/report comune, axe, server standalone loopback, cleanup asset standalone e sei baseline Windows/Linux | 12/12 E2E: viewport 320/390/1440, touch, tastiera/focus/zoom/safe-area, reduced-motion, axe positivo/negativo, server/browser/drift failure; due run stabili per piattaforma; report artifact solo JUnit | QA-002 integrato su `main`; full `verify` 420 test, checkout pulito, review inline, CI PR `29593436887` e post-merge `29593746286` verdi |
| W3C Trace Context e request ID attraversano web→API→queue→worker senza context bleed | spec §§24.1, 24.5; ADR-0007 | BL-008 | `packages/observability`, plugin Fastify e wrapper worker | `tests/integration/observability-flow.test.mjs`: parent chain `web.request`→`api.request`→`queue.enqueue`→`worker.process`, due flussi concorrenti disgiunti; PR #20/run `29415397361` | PASS mirato/full/clean/CI |
| Log JSON e metadata telemetry non espongono PII, secret, prompt o output AI | spec §§22.10, 24.2; ADR-0007 | BL-008 | sanitizer bounded, logger Pino allowlisted e reporter safe | `tests/unit/observability-core.test.mjs`, `tests/unit/observability-node.test.mjs`, `tests/security/observability-security.test.mjs`; PR #20/run `29415397361` | PASS mirato/full/clean/CI |
| Sentry resta error-only, off-by-default e non altera il risultato applicativo | spec §§24.4, 24.5; ADR-0007 | BL-008 | adapter Node/Next, transport fake, failure containment idempotente e bounded | unit/integration/security: exporter, destination e transport failure; zero rete; nessun Replay/profiling/log forwarding/tunnel/source map; PR #20/run `29415397361` | PASS mirato/full/clean/CI |
| Boundary browser/Node e startup config osservabilità falliscono in modo sicuro | spec §§11.3, 24.4; ADR-0004, ADR-0007 | BL-008 | export root browser-safe e `/node`; config DSN service-scoped; entrypoint Next lazy | `tests/contracts/observability-contract.test.mjs`, runtime config/startup integration, artifact client e PR #20/run `29415397361` | PASS mirato/full/clean/CI |
| Preview/staging e smoke remoto restano obbligatori prima di utenti esterni senza bloccare il playable loop locale | spec §§29.3–29.4, §30, §31 `BL-080`; DoD §35.1 | BL-003, BL-080, GATE-M0, BL-070 | foundation, `/health`, progetto collegato, protezioni, Git auto-deploy spento e guard Preview-only | PR #12 e CLI su `1060228` entrambi Production/rimossi; freeze PR #16/merge `aa9342d`, CI `29343319207`/`29343526054` verdi e zero deploy; audit omissione client + ipotesi first-deployment + issue CLI `#17069`; GATE-M0 full locale verde senza Vercel | BL-080 BLOCKED/PARTIAL; nessuno staging; serve fix/workaround provider; M1→M6 possono avanzare in locale senza deploy |
| Build provider limitato a Preview senza leakage | spec §§22.10, 29.3–29.4; ADR-0005 proposed | BL-080 | `apps/web/vercel.json`, build script dedicato, policy pura e target metadata nella cache Turbo | unit policy, security subprocess e contract deployment versionati; build Vercel richiede `VERCEL=1`, `VERCEL_ENV=preview`, `VERCEL_TARGET_ENV=preview`; locale ammesso solo con tutti assenti | guard integrato; secondo record Production `ERROR`, ma log post-rimozione insufficienti per attribuire l'errore al guard |
| Payload CLI minimo e verificato prima di creare deployment | spec §§22.10, 29.3–29.4; ADR-0005 proposed | BL-080 | `.vercelignore`, dry-run parser e deployment foundation contract | test unit/security/contract; dry-run `nextjs` dalla root con 158 entry e 1.093.594 byte; mode/hash/symlink, cache/output/env/path non relativi e budget oltre soglia falliscono chiusi | PR #15/merge `1060228`, CI PR/post-merge verdi; contratto payload PASS |
| Creazione manuale fail-closed nel percorso approvato | spec §§29.3–29.4, §31 `BL-080`; ADR-0005 proposed | BL-080 | `source.manualDeployment.enabled=false`, `scripts/assert-vercel-preview-bootstrap-enabled.mjs` | unit policy, security subprocess statico e contract manifest; `deploy:bootstrap:check` expected exit `1`; PR #16 CI/post-merge 5/5 | interlock procedurale integrato; non è enforcement provider contro owner; riapertura vietata senza fix/workaround Preview-only supportato |
| Deploy web riconducibile a project/deployment/SHA/ref/repository/regione | spec §29.4; ADR-0005 proposed | BL-080 | `web-health-v1`, smoke fail-closed, manifest unlinked dopo PR #13 | dispatch Production rifiutato; run `29331534774` skipped; secondo record senza nuovo smoke; URL/alias rimossi `404` | controllo di rifiuto PASS; requisito Preview BLOCKED sul provider |

## UX/UI P0

| ID | Requisito normativo | Task | Codice | Test | Evidenza corrente |
|---|---|---|---|---|---|
| UX-P0-01 | Core loop completo a 320 px; baseline 360–430 px | BL-079, BL-081, BL-040, QA-002 | `InteractiveGameShell`, reducer e fixture in `apps/web` | reducer/contract/smoke standalone + `game-shell.spec.mjs` | 320×800, 390×844 touch e 1440×900 senza overflow; submit/continue e CTA raggiungibili PASS |
| UX-P0-02 | Feed conversazionale, decisione e composer dominano il primo livello | BL-079, BL-081, BL-040 | `GameConversation`, `NarrativeTurn`, `SuggestedActions`, `FreeActionComposer` | contract UI, smoke HTML e browser E2E/visual | feed, due azioni e composer visibili insieme a 320 px; sei stati deterministici e retry guard testati |
| UX-P0-03 | HUD secondaria in drawer/sheet; desktop senza funzioni esclusive | BL-081, BL-040, QA-002 | `GameDrawer`, Vaul/shadcn e responsive shell | contract + browser 320/390/1440 | tre sezioni HUD, Escape e focus restore PASS; stessa gerarchia desktop |
| UX-P0-04 | shadcn/ui `new-york` su Radix e token semantici | BL-079 | `apps/web/components.json`, `app/globals.css`, `components/ui` | `tests/contracts/web-design-system.test.mjs` | contract 7/7 e build web PASS; Tailwind 4.3.2, Geist 1.7.2, cinque primitive selettive |
| UX-P0-05 | AI Elements selettivo non sostituisce `TurnView`, REST+SSE o idempotenza | BL-081, BL-040, BL-041 | subset `conversation`/`message`/`prompt-input` e reducer/view model locale | `tests/contracts/web-interactive-game-shell.test.mjs`; negative boundary scan | nessun `useChat`, AI SDK, route chat, storage o trasporto parallelo; backend turno resta planned |
| UX-P0-06 | Motion lazy, reduced-motion e nessuna informazione affidata all’animazione | BL-081, BL-027, BL-040, QA-002 | `GameMotionProvider`, feature DOM asincrona e fallback statico | contract + E2E con media feature reduced | `LazyMotion` strict, transform/opacity e contenuto equivalente senza transizioni; PASS |
| UX-P0-07 | Touch target ≥44 px, primarie ≥48 px, safe area/tastiera/zoom | BL-079, BL-081, BL-012, BL-019, BL-040, QA-002 | `Button`, `Input`, token touch/safe-area e feed `100svh` | contract + matrice E2E tastiera/focus/zoom/safe-area | minimo DOM 44 px, primarie 48 px, overlap `0`, zoom 200%, safe area 34 px, Tab order e focus restore PASS |
| UX-P0-08 | Stile premium contemporaneo, non pseudo-medievale | BL-079, QA-002 | token graphite/cobalto e shell contemporanea in `apps/web` | review React/design + sei baseline pixel-exact per piattaforma | nessun chrome fantasy, font remoto, gradiente invasivo o runtime grafico; Windows/Linux stabili su due run |
| UX-P0-09 | Dado decorativo riproduce risultato backend e possiede fallback | BL-040, BL-043 | dice tray (planned) | rules contract + reduced-motion UI test (planned) | spec §21.4 |

## Criteri globali

Il mapping completo AC-01..AC-25 è definito in `docs/TASKS.md` §19 e verrà sostituito qui con riferimenti reali man mano che codice e suite vengono creati. Fino ad allora, `docs/MVP_SPEC.md` §32.3 resta l’indice normativo sintetico.

## Regola di aggiornamento

Ogni task funzionale aggiunge o aggiorna almeno una riga con path reali. Un task non passa a `DONE` se il test richiesto è soltanto `planned`, salvo che il task sia esclusivamente documentale e disponga della propria evidenza riproducibile.
